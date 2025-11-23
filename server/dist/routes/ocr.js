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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Simple scaffold for OCR endpoints
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const child_process_1 = require("child_process");
const util_1 = require("util");
const crypto_1 = require("crypto");
// Import the clean-recipe-service client wrapper — it will POST to the
// microservice when `CLEAN_RECIPE_SERVICE_URL` is configured, otherwise
// it falls back to a local cleaning implementation.
const client_1 = require("../05_frameworks/cleanRecipe/client");
const gateway_1 = require("../05_frameworks/myexpress/gateway");
const client_2 = require("../05_frameworks/pubsub/client");
const OcrJobRepository_1 = require("../03_adapters/repositories/OcrJobRepository");
const execFileAsync = (0, util_1.promisify)(child_process_1.execFile);
const router = (0, express_1.Router)();
// Apply OCR rate limiter to all OCR routes
router.use(gateway_1.ocrLimiter);
// Check if async processing is enabled
let asyncProcessingEnabled = false;
(() => __awaiter(void 0, void 0, void 0, function* () {
    asyncProcessingEnabled = yield (0, client_2.isPubSubAvailable)();
    if (asyncProcessingEnabled) {
        console.log("OCR async processing enabled (Pub/Sub available)");
    }
    else {
        console.log("OCR async processing disabled (Pub/Sub unavailable, using sync mode)");
    }
}))();
const upload = (0, multer_1.default)({ dest: path_1.default.join(process.cwd(), "data/ocr_tmp") });
// Use native tesseract binary via child_process for server-side OCR
// The server environment (container) must have `tesseract` installed.
// POST /api/ocr
// Accept multiple files posted as form-data under any field name.
// Using upload.any() avoids Multer "Unexpected field" errors when clients
// name fields differently (e.g. image, image[], files, etc.).
const uploadAny = upload.any();
function handleOcrUpload(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        try {
            // Multer will populate req.files. When using upload.any() it's an array.
            let files = [];
            if (Array.isArray(req.files)) {
                files = req.files;
            }
            else if (req.files && typeof req.files === "object") {
                // Some setups may present files as an object keyed by field name
                const filesObj = req.files;
                Object.keys(filesObj).forEach((k) => {
                    if (Array.isArray(filesObj[k]))
                        files.push(...filesObj[k]);
                });
            }
            const ocrText = ((_a = req.body) === null || _a === void 0 ? void 0 : _a.ocrText) || "";
            if (files.length === 0) {
                return res.status(400).json({ message: "No files uploaded" });
            }
            const destDir = path_1.default.join(process.cwd(), "data/ocr");
            fs_1.default.mkdirSync(destDir, { recursive: true });
            const stored = [];
            for (const file of files) {
                const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
                const destPath = path_1.default.join(destDir, `${id}_${file.originalname}`);
                try {
                    fs_1.default.renameSync(file.path, destPath);
                }
                catch (e) {
                    // If rename fails, try copying then unlink
                    try {
                        fs_1.default.copyFileSync(file.path, destPath);
                        fs_1.default.unlinkSync(file.path);
                    }
                    catch (e2) {
                        console.error("Failed to persist uploaded file:", e2);
                    }
                }
                stored.push({ id, originalName: file.originalname, storedAt: destPath });
            }
            const filePaths = stored.map(s => s.storedAt);
            // If async processing is enabled, create job and publish to Pub/Sub
            if (asyncProcessingEnabled) {
                try {
                    const jobId = (0, crypto_1.randomUUID)();
                    const userId = (_b = req.user) === null || _b === void 0 ? void 0 : _b.id; // Assuming auth middleware sets req.user
                    // Create job in database
                    yield OcrJobRepository_1.ocrJobRepository.create({
                        jobId,
                        userId,
                        filePaths,
                        ocrText: ocrText || null,
                    });
                    // Publish to Pub/Sub
                    yield (0, client_2.publishOcrJob)({
                        jobId,
                        userId,
                        filePaths,
                        ocrText: ocrText || undefined,
                    });
                    console.log(JSON.stringify({
                        type: "ocr-job-created",
                        jobId,
                        userId,
                        fileCount: filePaths.length,
                        timestamp: new Date().toISOString(),
                    }));
                    return res.json({
                        jobId,
                        status: "pending",
                        statusUrl: `/api/ocr/status/${jobId}`,
                        message: "OCR job submitted for processing",
                    });
                }
                catch (pubsubError) {
                    console.error("Async OCR job creation failed, falling back to sync:", pubsubError);
                    // Fall through to synchronous processing
                }
            }
            // Synchronous processing fallback (original behavior)
            // Run native tesseract binary on stored files and collect output
            const ocrTexts = [];
            function runTesseract(filePath) {
                return __awaiter(this, void 0, void 0, function* () {
                    try {
                        const { stdout } = yield execFileAsync("tesseract", [filePath, "stdout", "-l", "eng"], { maxBuffer: 10 * 1024 * 1024 });
                        return (stdout || "").toString();
                    }
                    catch (err) {
                        // If the binary isn't found, surface a helpful error
                        if (err && err.code === "ENOENT") {
                            throw new Error("Tesseract binary not found (install tesseract-ocr in the container)");
                        }
                        throw err;
                    }
                });
            }
            for (const s of stored) {
                try {
                    const text = yield runTesseract(s.storedAt);
                    ocrTexts.push(text || "");
                }
                catch (ocrErr) {
                    console.error("Tesseract OCR failed for", s.storedAt, ocrErr);
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
                notes: ["Imported via server OCR"],
            };
            // Optionally forward parsed recipe to the clean-recipe-service. The
            // wrapper will fall back to a local cleaner if the microservice URL
            // is not configured or the request fails.
            let cleaned = parsed;
            try {
                cleaned = yield (0, client_1.cleanRecipe)(parsed);
            }
            catch (err) {
                console.warn("Forwarding to clean service failed, returning raw parse", err && err.message);
                cleaned = parsed;
            }
            res.json({
                parsed: cleaned,
                rawParsed: parsed,
                text: combinedText || ocrText,
                meta: { files: stored },
            });
        }
        catch (err) {
            console.error("OCR upload handler error:", err);
            res.status(500).json({ message: "OCR upload failed" });
        }
    });
}
// Wrap the multer middleware so we can catch MulterError and return a 400
function uploadHandlerWrapper(mw, handler) {
    return (req, res) => {
        mw(req, res, (err) => {
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
router.post("/ocr/parse", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e;
    try {
        // Concise diagnostic logging for troubleshooting requests reaching Express
        try {
            const origin = ((_a = req.headers) === null || _a === void 0 ? void 0 : _a.origin) || null;
            const cookiePresent = !!((_b = req.headers) === null || _b === void 0 ? void 0 : _b.cookie);
            const contentLength = ((_c = req.headers) === null || _c === void 0 ? void 0 : _c["content-length"]) || null;
            const hasAuth = !!((_d = req.headers) === null || _d === void 0 ? void 0 : _d.authorization);
            let authSummary = null;
            if (hasAuth) {
                const a = String(req.headers.authorization || "");
                authSummary = a.length > 40 ? `${a.slice(0, 20)}...${a.slice(-12)}` : a;
            }
            console.log(`/ocr/parse called: ip=${req.ip || ((_e = req.connection) === null || _e === void 0 ? void 0 : _e.remoteAddress) || "unknown"} method=${req.method} url=${req.originalUrl || req.url} origin=${origin} cookie=${cookiePresent} content-length=${contentLength} authPresent=${hasAuth}`);
            if (authSummary)
                console.log(`/ocr/parse auth-summary: ${authSummary}`);
            // Body preview (trimmed) — avoid logging full tokens or very large payloads
            const bodyPreview = typeof req.body === "string"
                ? req.body.slice(0, 2048)
                : JSON.stringify(req.body || {}).slice(0, 2048);
            console.log(`/ocr/parse body-preview: ${bodyPreview}`);
        }
        catch (logErr) {
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
        };
        // Try to forward to clean-recipe-service; wrapper handles fallback.
        try {
            const cleaned = yield (0, client_1.cleanRecipe)(parsed);
            return res.json({ parsed: cleaned, text: ocrText });
        }
        catch (err) {
            console.warn("/ocr/parse: clean service forwarding failed", err && err.message);
            return res.json({ parsed, text: ocrText });
        }
    }
    catch (err) {
        console.error("/ocr/parse error:", err);
        res.status(500).json({ message: "Parse failed" });
    }
}));
// GET /api/ocr/gallery - list files
router.get("/ocr/gallery", (_req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const dir = path_1.default.join(process.cwd(), "data/ocr");
        if (!fs_1.default.existsSync(dir))
            return res.json([]);
        const files = fs_1.default
            .readdirSync(dir)
            .map((name) => ({ id: name, originalUrl: `/data/ocr/${name}` }));
        res.json(files);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to read gallery" });
    }
}));
// DELETE /api/ocr/:id
router.delete("/ocr/:id", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const id = req.params.id;
        const dir = path_1.default.join(process.cwd(), "data/ocr");
        const file = path_1.default.join(dir, id);
        if (fs_1.default.existsSync(file))
            fs_1.default.unlinkSync(file);
        res.json({ ok: true });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: "Delete failed" });
    }
}));
// GET /api/ocr/health - check async processing status
router.get("/ocr/health", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const pubsubAvailable = yield (0, client_2.isPubSubAvailable)();
        res.json({
            asyncProcessingEnabled,
            pubsubCheckResult: pubsubAvailable,
            gcpProjectId: process.env.GCP_PROJECT_ID || null,
            ocrJobsTopic: process.env.OCR_JOBS_TOPIC || "ocr-jobs",
        });
    }
    catch (err) {
        res.status(500).json({
            asyncProcessingEnabled,
            error: err instanceof Error ? err.message : String(err),
        });
    }
}));
// GET /api/ocr/status/:jobId - check status of async OCR job
router.get("/ocr/status/:jobId", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { jobId } = req.params;
        const job = yield OcrJobRepository_1.ocrJobRepository.findByJobId(jobId);
        if (!job) {
            return res.status(404).json({ message: "Job not found" });
        }
        // Return job status without sensitive internal details
        const response = {
            jobId: job.jobId,
            status: job.status,
            createdAt: job.createdAt,
            updatedAt: job.updatedAt,
        };
        if (job.status === "completed") {
            response.result = job.result;
            response.ocrText = job.ocrText;
            response.processingTimeMs = job.processingTimeMs;
        }
        else if (job.status === "failed") {
            response.error = job.error;
        }
        res.json(response);
    }
    catch (err) {
        console.error("Error fetching job status:", err);
        res.status(500).json({ message: "Failed to fetch job status" });
    }
}));
exports.default = router;
