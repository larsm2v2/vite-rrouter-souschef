// Simple scaffold for OCR endpoints
import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";

const router = Router();
const upload = multer({ dest: path.join(process.cwd(), "data/ocr_tmp") });

// POST /api/ocr
router.post("/ocr", upload.single("image"), async (req, res) => {
  try {
    // req.file contains uploaded image; req.body.ocrText contains client OCR text
    const file = req.file;
    const ocrText = req.body?.ocrText || "";

    // For now, store the uploaded file and return a minimal parsed placeholder.
    const id = Date.now().toString(36);
    const destDir = path.join(process.cwd(), "data/ocr");
    fs.mkdirSync(destDir, { recursive: true });
    const destPath = path.join(destDir, `${id}_${file.originalname}`);
    fs.renameSync(file.path, destPath);

    // TODO: run server-side parsing heuristics to build GeneratedRecipe shape
    const parsed = {
      name: undefined,
      cuisine: undefined,
      ingredients: { "from-ocr": [] },
      instructions: [{ number: 1, text: ocrText }],
      notes: ["Imported via server OCR"],
    };

    res.json({ parsed, text: ocrText, meta: { id, storedAt: destPath } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "OCR upload failed" });
  }
});

// GET /api/ocr/gallery - list files
router.get("/ocr/gallery", async (_req, res) => {
  try {
    const dir = path.join(process.cwd(), "data/ocr");
    if (!fs.existsSync(dir)) return res.json([]);
    const files = fs.readdirSync(dir).map((name) => ({ id: name, originalUrl: `/data/ocr/${name}` }));
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
