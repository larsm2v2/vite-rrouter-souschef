import { PubSub, Message } from "@google-cloud/pubsub";
import { execFile } from "child_process";
import { promisify } from "util";
import { cleanRecipe as forwardToCleanService } from "../05_frameworks/cleanRecipe/client";
import { ocrJobRepository } from "../03_adapters/repositories/OcrJobRepository";
import type { OcrJobMessage } from "../05_frameworks/pubsub/client";

const execFileAsync = promisify(execFile);

const projectId = process.env.GCP_PROJECT_ID || "souschef4me";
const subscriptionName = process.env.OCR_JOBS_SUBSCRIPTION || "ocr-worker-sub";

// Pub/Sub client and subscription are created lazily to avoid throwing during
// module import when Google Application Default Credentials are not configured.
let pubsub: PubSub | null = null;
let subscription: ReturnType<PubSub["subscription"]> | null = null;

// Tesseract OCR execution
async function runTesseract(filePath: string): Promise<string> {
  try {
    const { stdout } = await execFileAsync(
      "tesseract",
      [filePath, "stdout", "-l", "eng"],
      { maxBuffer: 10 * 1024 * 1024 }
    );
    return (stdout || "").toString();
  } catch (err: any) {
    if (err && err.code === "ENOENT") {
      throw new Error(
        "Tesseract binary not found (install tesseract-ocr in the container)"
      );
    }
    throw err;
  }
}

// Process a single OCR job
async function processOcrJob(jobData: OcrJobMessage): Promise<void> {
  const startTime = Date.now();
  const { jobId, filePaths, ocrText } = jobData;

  console.log(
    JSON.stringify({
      type: "ocr-job-processing-start",
      jobId,
      fileCount: filePaths.length,
      timestamp: new Date().toISOString(),
    })
  );

  try {
    // Update job status to processing
    await ocrJobRepository.update(jobId, { status: "processing" });

    // Run OCR on all uploaded files
    const ocrTexts: string[] = [];
    for (const filePath of filePaths) {
      try {
        const text = await runTesseract(filePath);
        ocrTexts.push(text || "");
      } catch (ocrErr) {
        console.error(`Tesseract OCR failed for ${filePath}:`, ocrErr);
        ocrTexts.push("");
      }
    }

    const combinedText = ocrTexts.join("\n\n").trim();
    const lines = combinedText
      .split(/\r?\n/)
      .map((l: string) => l.trim())
      .filter((l: string) => l.length > 0);

    const instructions =
      lines.length > 0
        ? lines.map((l: string, i: number) => ({ number: i + 1, text: l }))
        : [{ number: 1, text: combinedText }];

    const parsed = {
      name: undefined,
      cuisine: undefined,
      ingredients: { "from-ocr": [] },
      instructions,
      notes: ["Imported via async OCR worker"],
    } as any;

    // Forward to clean-recipe-service
    let cleaned: any = parsed;
    try {
      cleaned = await forwardToCleanService(parsed);
    } catch (err) {
      console.warn(
        "Forwarding to clean service failed, using raw parse",
        err && (err as Error).message
      );
      cleaned = parsed;
    }

    const processingTimeMs = Date.now() - startTime;

    // Update job with completed status and result
    await ocrJobRepository.update(jobId, {
      status: "completed",
      ocrText: combinedText || ocrText || undefined,
      result: cleaned,
      processingTimeMs,
    });

    console.log(
      JSON.stringify({
        type: "ocr-job-processing-complete",
        jobId,
        processingTimeMs,
        timestamp: new Date().toISOString(),
      })
    );
  } catch (error) {
    const processingTimeMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    console.error(
      JSON.stringify({
        type: "ocr-job-processing-error",
        jobId,
        error: errorMessage,
        processingTimeMs,
        timestamp: new Date().toISOString(),
      })
    );

    // Update job with failed status
    await ocrJobRepository.update(jobId, {
      status: "failed",
      error: errorMessage,
      processingTimeMs,
    });
  }
}

// Message handler
function messageHandler(message: Message) {
  try {
    const jobData = message.data
      ? JSON.parse(message.data.toString())
      : message.attributes;

    console.log(
      JSON.stringify({
        type: "pubsub-message-received",
        messageId: message.id,
        jobId: jobData.jobId,
        timestamp: new Date().toISOString(),
      })
    );

    // Process job asynchronously
    processOcrJob(jobData)
      .then(() => {
        message.ack();
        console.log(`Message ${message.id} acknowledged`);
      })
      .catch((err) => {
        console.error(`Failed to process message ${message.id}:`, err);
        // Nack to retry (Pub/Sub will redeliver)
        message.nack();
      });
  } catch (err) {
    console.error(`Error parsing message ${message.id}:`, err);
    message.nack();
  }
}

// Start worker
export function startOcrWorker() {
  console.log(
    `Starting OCR worker... (subscription: ${subscriptionName}, project: ${projectId})`
  );

  try {
    pubsub = new PubSub({ projectId });
    subscription = pubsub.subscription(subscriptionName);

    subscription.on("message", messageHandler);

    subscription.on("error", (error) => {
      console.error("Subscription error:", error);
    });
  } catch (err) {
    // If Pub/Sub credentials are not available, don't crash the process.
    console.error("Failed to initialize Pub/Sub subscription for OCR worker:", err);
    console.warn("OCR worker will not start. Run the worker with proper GCP credentials.");
    return; // Do not start the worker if Pub/Sub is unavailable
  }

  // Graceful shutdown
  process.on("SIGINT", () => {
    console.log("Shutting down OCR worker...");
    subscription.close();
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    console.log("Shutting down OCR worker...");
    subscription.close();
    process.exit(0);
  });

  console.log("OCR worker started successfully");
}

// Run worker if executed directly
if (require.main === module) {
  startOcrWorker();
}
