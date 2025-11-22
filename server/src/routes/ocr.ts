// Simple scaffold for OCR endpoints
import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { execFile } from "child_process";
import { promisify } from "util";
// Import the clean-recipe-service client wrapper — it will POST to the
// microservice when `CLEAN_RECIPE_SERVICE_URL` is configured, otherwise
// it falls back to a local cleaning implementation.
import { cleanRecipe as forwardToCleanService } from "../05_frameworks/cleanRecipe/client";
const execFileAsync = promisify(execFile);

const router = Router();
const upload = multer({ dest: path.join(process.cwd(), "data/ocr_tmp") });
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

    const destDir = path.join(process.cwd(), "data/ocr");
    fs.mkdirSync(destDir, { recursive: true });

    const stored: any[] = [];
    for (const file of files) {
      const id =
        Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      const destPath = path.join(destDir, `${id}_${file.originalname}`);
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

    // Run native tesseract binary on stored files and collect output
    const ocrTexts: string[] = [];
    async function runTesseract(filePath: string) {
      try {
        const { stdout } = await execFileAsync(
          "tesseract",
          [filePath, "stdout", "-l", "eng"],
          { maxBuffer: 10 * 1024 * 1024 }
        );
        return (stdout || "").toString();
      } catch (err: any) {
        // If the binary isn't found, surface a helpful error
        if (err && err.code === "ENOENT") {
          throw new Error(
            "Tesseract binary not found (install tesseract-ocr in the container)"
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
      console.warn("Forwarding to clean service failed, returning raw parse", err && (err as Error).message);
      cleaned = parsed;
    }

    res.json({ parsed: cleaned, rawParsed: parsed, text: combinedText || ocrText, meta: { files: stored } });
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
    // Diagnostic logging: record incoming parse requests for troubleshooting
    try {
      console.log("/ocr/parse called. headers:", req.headers);
      // Avoid logging huge bodies in production, but useful for debugging now
      console.log("/ocr/parse body preview:", typeof req.body === 'string' ? req.body.slice(0,1000) : JSON.stringify(req.body).slice(0,1000));
    } catch (logErr) {
      console.warn("Failed to log /ocr/parse details:", logErr);
    }
    const ocrText = (req.body && (req.body.text || req.body.ocrText)) || "";

    // Minimal structured response: server-side parsing heuristics can be added later
    const parsed = {
      name: undefined,
      cuisine: undefined,
      ingredients: { "from-ocr": [] },
      instructions: [{ number: 1, text: ocrText }],
      notes: ["Parsed via /ocr/parse"],
    } as any;

    // Try to forward to clean-recipe-service; wrapper handles fallback.
    try {
      const cleaned = await forwardToCleanService(parsed);
      return res.json({ parsed: cleaned, text: ocrText });
    } catch (err) {
      console.warn("/ocr/parse: clean service forwarding failed", err && (err as Error).message);
      return res.json({ parsed, text: ocrText });
    }
  } catch (err) {
    console.error("/ocr/parse error:", err);
    res.status(500).json({ message: "Parse failed" });
  }
});

// GET /api/ocr/gallery - list files
router.get("/ocr/gallery", async (_req, res) => {
  try {
    const dir = path.join(process.cwd(), "data/ocr");
    if (!fs.existsSync(dir)) return res.json([]);
    const files = fs
      .readdirSync(dir)
      .map((name) => ({ id: name, originalUrl: `/data/ocr/${name}` }));
    res.json(files);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to read gallery" });
  }
});

// DELETE /api/ocr/:id
router.delete("/ocr/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const dir = path.join(process.cwd(), "data/ocr");
    const file = path.join(dir, id);
    if (fs.existsSync(file)) fs.unlinkSync(file);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Delete failed" });
  }
});

export default router;
