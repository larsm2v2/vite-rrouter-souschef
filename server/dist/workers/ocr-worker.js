"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startOcrWorker = startOcrWorker;
const pubsub_1 = require("@google-cloud/pubsub");
const child_process_1 = require("child_process");
const util_1 = require("util");
const client_1 = require("../05_frameworks/cleanRecipe/client");
const OcrJobRepository_1 = require("../03_adapters/repositories/OcrJobRepository");
const execFileAsync = (0, util_1.promisify)(child_process_1.execFile);
const projectId = process.env.GCP_PROJECT_ID || "souschef4me";
const subscriptionName = process.env.OCR_JOBS_SUBSCRIPTION || "ocr-worker-sub";
const pubsub = new pubsub_1.PubSub({ projectId });
const subscription = pubsub.subscription(subscriptionName);
// Tesseract OCR execution
function runTesseract(filePath) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { stdout } = yield execFileAsync("tesseract", [filePath, "stdout", "-l", "eng"], { maxBuffer: 10 * 1024 * 1024 });
            return (stdout || "").toString();
        }
        catch (err) {
            if (err && err.code === "ENOENT") {
                throw new Error("Tesseract binary not found (install tesseract-ocr in the container)");
            }
            throw err;
        }
    });
}
// Process a single OCR job
function processOcrJob(jobData) {
    return __awaiter(this, void 0, void 0, function* () {
        const startTime = Date.now();
        const { jobId, filePaths, ocrText } = jobData;
        console.log(JSON.stringify({
            type: "ocr-job-processing-start",
            jobId,
            fileCount: filePaths.length,
            timestamp: new Date().toISOString(),
        }));
        try {
            // Update job status to processing
            yield OcrJobRepository_1.ocrJobRepository.update(jobId, { status: "processing" });
            // Run OCR on all uploaded files
            const ocrTexts = [];
            for (const filePath of filePaths) {
                try {
                    const text = yield runTesseract(filePath);
                    ocrTexts.push(text || "");
                }
                catch (ocrErr) {
                    console.error(`Tesseract OCR failed for ${filePath}:`, ocrErr);
                    ocrTexts.push("");
                }
            }
            const combinedText = ocrTexts.join("\n\n").trim();
            const lines = combinedText
                .split(/\r?\n/)
                .map((l) => l.trim())
                .filter((l) => l.length > 0);
            const instructions = lines.length > 0
                ? lines.map((l, i) => ({ number: i + 1, text: l }))
                : [{ number: 1, text: combinedText }];
            const parsed = {
                name: undefined,
                cuisine: undefined,
                ingredients: { "from-ocr": [] },
                instructions,
                notes: ["Imported via async OCR worker"],
            };
            // Forward to clean-recipe-service
            let cleaned = parsed;
            try {
                cleaned = yield (0, client_1.cleanRecipe)(parsed);
            }
            catch (err) {
                console.warn("Forwarding to clean service failed, using raw parse", err && err.message);
                cleaned = parsed;
            }
            const processingTimeMs = Date.now() - startTime;
            // Update job with completed status and result
            yield OcrJobRepository_1.ocrJobRepository.update(jobId, {
                status: "completed",
                ocrText: combinedText || ocrText || undefined,
                result: cleaned,
                processingTimeMs,
            });
            console.log(JSON.stringify({
                type: "ocr-job-processing-complete",
                jobId,
                processingTimeMs,
                timestamp: new Date().toISOString(),
            }));
        }
        catch (error) {
            const processingTimeMs = Date.now() - startTime;
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(JSON.stringify({
                type: "ocr-job-processing-error",
                jobId,
                error: errorMessage,
                processingTimeMs,
                timestamp: new Date().toISOString(),
            }));
            // Update job with failed status
            yield OcrJobRepository_1.ocrJobRepository.update(jobId, {
                status: "failed",
                error: errorMessage,
                processingTimeMs,
            });
        }
    });
}
// Message handler
function messageHandler(message) {
    try {
        const jobData = message.data
            ? JSON.parse(message.data.toString())
            : message.attributes;
        console.log(JSON.stringify({
            type: "pubsub-message-received",
            messageId: message.id,
            jobId: jobData.jobId,
            timestamp: new Date().toISOString(),
        }));
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
    }
    catch (err) {
        console.error(`Error parsing message ${message.id}:`, err);
        message.nack();
    }
}
// Start worker
function startOcrWorker() {
    console.log(`Starting OCR worker... (subscription: ${subscriptionName}, project: ${projectId})`);
    subscription.on("message", messageHandler);
    subscription.on("error", (error) => {
        console.error("Subscription error:", error);
    });
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
