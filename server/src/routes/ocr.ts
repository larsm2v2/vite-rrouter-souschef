// Simple scaffold for OCR endpoints
import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { execFile } from "child_process";
import { promisify } from "util";
import { randomUUID } from "crypto";
// Import the clean-recipe-service client wrapper — it will POST to the
// microservice when `CLEAN_RECIPE_SERVICE_URL` is configured, otherwise
// it falls back to a local cleaning implementation.
import { cleanRecipe as forwardToCleanService } from "../05_frameworks/cleanRecipe/client";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { ocrParsePrompt } from "../utils/prompts";

const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;
import { ocrLimiter } from "../05_frameworks/myexpress/gateway";
import { authenticateJWT } from "../05_frameworks/myexpress/jwtAuth";
import {
  publishOcrJob,
  isPubSubAvailable,
} from "../05_frameworks/pubsub/client";
import { ocrJobRepository } from "../03_adapters/repositories/OcrJobRepository";

const execFileAsync = promisify(execFile);

const router = Router();

// Apply OCR rate limiter to all OCR routes
router.use(ocrLimiter);

// Every OCR route handles user content, so require a valid access token
// (defense in depth: the router is also mounted behind /api auth).
router.use("/ocr", authenticateJWT);

const OCR_DIR = path.join(process.cwd(), "data/ocr");
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

/** Strip any directory components and unsafe characters from a client filename. */
function sanitizeFilename(name: string): string {
  const base = path
    .basename(String(name || "upload"))
    .replace(/[^\w.-]+/g, "_");
  return base.replace(/^\.+/, "").slice(0, 100) || "upload";
}

/**
 * Resolve a stored OCR file for a user. Stored names are prefixed with the
 * owner's id, so a user can never address another user's file, and the
 * resolved path must stay inside the OCR directory.
 */
function resolveUserFile(userId: number, rawName: string): string | null {
  const name = path.basename(String(rawName));
  if (name !== rawName || !name.startsWith(`${userId}_`)) return null;
  const resolved = path.resolve(OCR_DIR, name);
  return resolved.startsWith(OCR_DIR + path.sep) ? resolved : null;
}

// Check if async processing is enabled
let asyncProcessingEnabled = false;
(async () => {
  asyncProcessingEnabled = await isPubSubAvailable();
  if (asyncProcessingEnabled) {
    console.log("OCR async processing enabled (Pub/Sub available)");
  } else {
    console.log(
      "OCR async processing disabled (Pub/Sub unavailable, using sync mode)",
    );
  }
})();

const upload = multer({
  dest: path.join(process.cwd(), "data/ocr_tmp"),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 10 },
  fileFilter: (_req, file, cb) => {
    if (
      /^image\/(png|jpe?g|webp|gif|bmp|tiff?|heic|heif)$/i.test(file.mimetype)
    ) {
      return cb(null, true);
    }
    cb(new Error("Only image uploads are allowed"));
  },
});
// Use native tesseract binary via child_process for server-side OCR
// The server environment (container) must have `tesseract` installed.

// POST /api/ocr
// Accept multiple files posted as form-data under any field name.
// Using upload.any() avoids Multer "Unexpected field" errors when clients
// name fields differently (e.g. image, image[], files, etc.).
const uploadAny = upload.any();

async function handleOcrUpload(req: any, res: any) {
  try {
    // Multer will populate req.files. When using upload.any() it's an array.
    let files: any[] = [];
    if (Array.isArray(req.files)) {
      files = req.files as any[];
    } else if (req.files && typeof req.files === "object") {
      // Some setups may present files as an object keyed by field name
      const filesObj: any = req.files;
      Object.keys(filesObj).forEach((k) => {
        if (Array.isArray(filesObj[k])) files.push(...filesObj[k]);
      });
    }

    const ocrText = req.body?.ocrText || "";

    if (files.length === 0) {
      return res.status(400).json({ message: "No files uploaded" });
    }

    const destDir = OCR_DIR;
    fs.mkdirSync(destDir, { recursive: true });
    const ownerId = (req as any).user?.id;

    const stored: any[] = [];
    for (const file of files) {
      const id =
        Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      const safeName = sanitizeFilename(file.originalname);
      const destPath = path.join(destDir, `${ownerId}_${id}_${safeName}`);
      try {
        fs.renameSync(file.path, destPath);
      } catch (e) {
        // If rename fails, try copying then unlink
        try {
          fs.copyFileSync(file.path, destPath);
          fs.unlinkSync(file.path);
        } catch (e2) {
          console.error("Failed to persist uploaded file:", e2);
        }
      }
      stored.push({ id, originalName: file.originalname, storedAt: destPath });
    }

    const filePaths = stored.map((s) => s.storedAt);

    // If async processing is enabled, create job and publish to Pub/Sub
    if (asyncProcessingEnabled) {
      try {
        const jobId = randomUUID();
        const userId = (req as any).user?.id; // Assuming auth middleware sets req.user

        // Create job in database
        await ocrJobRepository.create({
          jobId,
          userId,
          filePaths,
          ocrText: ocrText || null,
        });

        // Publish to Pub/Sub
        await publishOcrJob({
          jobId,
          userId,
          filePaths,
          ocrText: ocrText || undefined,
        });

        console.log(
          JSON.stringify({
            type: "ocr-job-created",
            jobId,
            userId,
            fileCount: filePaths.length,
            timestamp: new Date().toISOString(),
          }),
        );

        return res.json({
          jobId,
          status: "pending",
          statusUrl: `/api/ocr/status/${jobId}`,
          message: "OCR job submitted for processing",
        });
      } catch (pubsubError) {
        console.error(
          "Async OCR job creation failed, falling back to sync:",
          pubsubError,
        );
        // Fall through to synchronous processing
      }
    }

    // Synchronous processing fallback (original behavior)
    // Run native tesseract binary on stored files and collect output
    const ocrTexts: string[] = [];
    async function runTesseract(filePath: string) {
      try {
        const { stdout } = await execFileAsync(
          "tesseract",
          [filePath, "stdout", "-l", "eng"],
          { maxBuffer: 10 * 1024 * 1024 },
        );
        return (stdout || "").toString();
      } catch (err: any) {
        // If the binary isn't found, surface a helpful error
        if (err && err.code === "ENOENT") {
          throw new Error(
            "Tesseract binary not found (install tesseract-ocr in the container)",
          );
        }
        throw err;
      }
    }

    for (const s of stored) {
      try {
        const text = await runTesseract(s.storedAt);
        ocrTexts.push(text || "");
      } catch (ocrErr) {
        console.error("Tesseract OCR failed for", s.storedAt, ocrErr);
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
      notes: ["Imported via server OCR"],
    } as any;

    // Optionally forward parsed recipe to the clean-recipe-service. The
    // wrapper will fall back to a local cleaner if the microservice URL
    // is not configured or the request fails.
    let cleaned: any = parsed;
    try {
      cleaned = await forwardToCleanService(parsed);
    } catch (err) {
      console.warn(
        "Forwarding to clean service failed, returning raw parse",
        err && (err as Error).message,
      );
      cleaned = parsed;
    }

    // Generate image URLs for stored files (relative to server)
    const imageUrls = stored.map(
      (s) => `/api/ocr/images/${path.basename(s.storedAt)}`,
    );

    res.json({
      parsed: cleaned,
      rawParsed: parsed,
      text: combinedText || ocrText,
      meta: { files: stored },
      imageUrls, // Include image URLs for frontend to save with recipe
    });
  } catch (err) {
    console.error("OCR upload handler error:", err);
    res.status(500).json({ message: "OCR upload failed" });
  }
}

// Wrap the multer middleware so we can catch MulterError and return a 400
function uploadHandlerWrapper(mw: any, handler: any) {
  return (req: any, res: any) => {
    mw(req, res, (err: any) => {
      if (err) {
        console.error("Multer error on upload:", err);
        // Multer exposes a MulterError class; treat as client error
        return res
          .status(400)
          .json({ message: err.message || "File upload error" });
      }
      return handler(req, res);
    });
  };
}

router.post("/ocr", uploadHandlerWrapper(uploadAny, handleOcrUpload));
// Backwards-compatible alias for clients hitting /api/ocr/upload
router.post("/ocr/upload", uploadHandlerWrapper(uploadAny, handleOcrUpload));

// POST /api/ocr/parse - accept JSON { text } and return parsed recipe
router.post("/ocr/parse", async (req, res) => {
  try {
    const ocrText = (req.body && (req.body.text || req.body.ocrText)) || "";

    if (!ocrText || ocrText.trim().length === 0) {
      return res.status(400).json({ message: "No text provided for parsing" });
    }

    // Use AI to parse the recipe text
    let parsed: any = {
      name: undefined,
      cuisine: undefined,
      ingredients: { "from-ocr": [] },
      instructions: [{ number: 1, text: ocrText }],
      notes: ["Parsed via /ocr/parse"],
    };

    if (genAI) {
      try {
        console.log("/ocr/parse: Attempting AI parsing with Gemini...");
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        // Use the improved prompt from prompts.ts
        const prompt = ocrParsePrompt(ocrText);
        console.log(`/ocr/parse: OCR text length: ${ocrText.length} chars`);

        const result = await model.generateContent(prompt);
        const response = result.response.text();
        console.log(`/ocr/parse: AI response length: ${response.length} chars`);
        console.log(
          `/ocr/parse: AI response preview: ${response.slice(0, 200)}...`,
        );

        // Clean up response - remove markdown code blocks if present
        let jsonText = response.trim();
        if (jsonText.startsWith("```json")) {
          jsonText = jsonText.slice(7);
        } else if (jsonText.startsWith("```")) {
          jsonText = jsonText.slice(3);
        }
        if (jsonText.endsWith("```")) {
          jsonText = jsonText.slice(0, -3);
        }
        jsonText = jsonText.trim();

        console.log(
          `/ocr/parse: Cleaned JSON length: ${jsonText.length} chars`,
        );
        console.log(`/ocr/parse: Attempting to parse JSON...`);

        const aiParsed = JSON.parse(jsonText);
        console.log(
          `/ocr/parse: Successfully parsed JSON. Keys: ${Object.keys(
            aiParsed,
          ).join(", ")}`,
        );

        // Merge AI parsed data with defaults
        parsed = { ...parsed, ...aiParsed };
        console.log("/ocr/parse: ✅ Successfully parsed recipe with AI");
      } catch (aiErr) {
        console.error(
          "/ocr/parse: ❌ AI parsing failed:",
          aiErr instanceof Error ? aiErr.message : String(aiErr),
        );
        if (aiErr instanceof Error && aiErr.stack) {
          console.error("/ocr/parse: Error stack:", aiErr.stack);
        }
        // Continue with basic parsed structure
      }
    } else {
      console.warn(
        "/ocr/parse: ⚠️ GEMINI_API_KEY not configured, skipping AI parsing",
      );
    }

    // Try to forward to clean-recipe-service; wrapper handles fallback.
    try {
      const cleaned = await forwardToCleanService(parsed);
      return res.json({ parsed: cleaned, text: ocrText });
    } catch (err) {
      console.warn(
        "/ocr/parse: clean service forwarding failed",
        err && (err as Error).message,
      );
      return res.json({ parsed, text: ocrText });
    }
  } catch (err) {
    console.error("/ocr/parse error:", err);
    res.status(500).json({ message: "Parse failed" });
  }
});

// GET /api/ocr/gallery - list the caller's files
router.get("/ocr/gallery", async (req, res) => {
  try {
    const userId = (req as any).user.id as number;
    if (!fs.existsSync(OCR_DIR)) return res.json([]);
    const files = fs
      .readdirSync(OCR_DIR)
      .filter((name) => name.startsWith(`${userId}_`))
      .map((name) => ({
        id: name,
        originalUrl: `/api/ocr/images/${encodeURIComponent(name)}`,
      }));
    res.json(files);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to read gallery" });
  }
});

// GET /api/ocr/images/:filename - serve one of the caller's uploaded images
router.get("/ocr/images/:filename", async (req, res) => {
  try {
    const filePath = resolveUserFile((req as any).user.id, req.params.filename);
    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(404).json({ message: "Image not found" });
    }
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "private, max-age=300");
    res.sendFile(filePath);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to serve image" });
  }
});

// DELETE /api/ocr/:id - delete one of the caller's files
router.delete("/ocr/:id", async (req, res) => {
  try {
    const file = resolveUserFile((req as any).user.id, req.params.id);
    if (!file || !fs.existsSync(file)) {
      return res.status(404).json({ message: "File not found" });
    }
    fs.unlinkSync(file);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Delete failed" });
  }
});

// GET /api/ocr/health - check async processing status
router.get("/ocr/health", async (req, res) => {
  try {
    const pubsubAvailable = await isPubSubAvailable();
    res.json({
      asyncProcessingEnabled,
      pubsubCheckResult: pubsubAvailable,
      gcpProjectId: process.env.GCP_PROJECT_ID || null,
      ocrJobsTopic: process.env.OCR_JOBS_TOPIC || "ocr-jobs",
    });
  } catch (err) {
    res.status(500).json({
      asyncProcessingEnabled,
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

// GET /api/ocr/status/:jobId - check status of async OCR job
router.get("/ocr/status/:jobId", async (req, res) => {
  try {
    const { jobId } = req.params;

    const job = await ocrJobRepository.findByJobId(jobId);

    // Treat other users' jobs as nonexistent so job ids can't be probed.
    if (!job || (job.userId != null && job.userId !== (req as any).user.id)) {
      return res.status(404).json({ message: "Job not found" });
    }

    // Return job status without sensitive internal details
    const response: any = {
      jobId: job.jobId,
      status: job.status,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    };

    if (job.status === "completed") {
      response.result = job.result;
      response.ocrText = job.ocrText;
      response.processingTimeMs = job.processingTimeMs;
    } else if (job.status === "failed") {
      response.error = job.error;
    }

    res.json(response);
  } catch (err) {
    console.error("Error fetching job status:", err);
    res.status(500).json({ message: "Failed to fetch job status" });
  }
});

export default router;
