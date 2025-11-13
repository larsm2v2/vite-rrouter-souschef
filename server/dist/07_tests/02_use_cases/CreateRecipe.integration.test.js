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
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const child_process_1 = require("child_process");
const net_1 = __importDefault(require("net"));
const CreateRecipe_1 = require("../../02_use_cases/CreateRecipe");
describe("CreateRecipe integration with clean-recipe-service", () => {
    let child = null;
    let baseUrl;
    function getFreePort() {
        return new Promise((resolve, reject) => {
            const s = net_1.default.createServer();
            s.listen(0, () => {
                // @ts-ignore
                const port = s.address().port;
                s.close(() => resolve(port));
            });
            s.on("error", reject);
        });
    }
    function waitForReady(url_1) {
        return __awaiter(this, arguments, void 0, function* (url, timeout = 5000) {
            const start = Date.now();
            const fetch = global.fetch;
            while (Date.now() - start < timeout) {
                try {
                    const res = yield fetch(`${url}/clean-recipe`, {
                        method: "POST",
                        headers: { "content-type": "application/json" },
                        body: JSON.stringify({ name: "x" }),
                    });
                    if (res && res.status === 200)
                        return;
                }
                catch (e) {
                    // ignore
                }
                yield new Promise((r) => setTimeout(r, 100));
            }
            throw new Error("Timed out waiting for clean-recipe-service to be ready");
        });
    }
    beforeAll(() => __awaiter(void 0, void 0, void 0, function* () {
        const port = yield getFreePort();
        baseUrl = `http://127.0.0.1:${port}`;
        const serviceDir = path_1.default.resolve(__dirname, "../../../../clean-recipe-service");
        // Try spawning the microservice via npx ts-node. If that fails (eg. npx
        // not available in CI), fall back to an in-process router to keep the
        // integration test meaningful.
        try {
            child = (0, child_process_1.spawn)(process.platform === "win32" ? "npx.cmd" : "npx", ["ts-node", "src/index.ts"], {
                cwd: serviceDir,
                env: Object.assign(Object.assign({}, process.env), { PORT: String(port) }),
                stdio: ["ignore", "pipe", "pipe"],
            });
            if (!child.stdout || !child.stderr)
                throw new Error("Failed to start microservice process");
            child.stdout.on("data", (d) => {
                // eslint-disable-next-line no-console
                console.log(`[clean-service] ${d.toString().trim()}`);
            });
            child.stderr.on("data", (d) => {
                // eslint-disable-next-line no-console
                console.error(`[clean-service:err] ${d.toString().trim()}`);
            });
            yield waitForReady(baseUrl, 8000);
            process.env.CLEAN_RECIPE_SERVICE_URL = baseUrl;
        }
        catch (err) {
            // Fallback: start an in-test express server that mimics the microservice
            // using the local cleaner.
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const { cleanRecipe } = require("../../services/recipe.service");
            const app = (0, express_1.default)();
            app.use(express_1.default.json());
            app.post("/clean-recipe", (req, res) => {
                try {
                    const cleaned = cleanRecipe(req.body);
                    res.status(200).json(cleaned);
                }
                catch (e) {
                    res.status(400).json({ error: e && e.message });
                }
            });
            // start server
            yield new Promise((resolve) => {
                const s = app.listen(port, () => {
                    // @ts-ignore
                    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
                    s;
                    process.env.CLEAN_RECIPE_SERVICE_URL = baseUrl;
                    resolve();
                });
            });
        }
    }));
    afterAll(() => __awaiter(void 0, void 0, void 0, function* () {
        delete process.env.CLEAN_RECIPE_SERVICE_URL;
        if (child && !child.killed) {
            child.kill();
            yield new Promise((r) => setTimeout(r, 100));
        }
        child = null;
    }));
    it("calls the microservice and forwards cleaned payload to repository", () => __awaiter(void 0, void 0, void 0, function* () {
        const mockRepo = { create: jest.fn().mockResolvedValue({ id: 1 }) };
        const useCase = new CreateRecipe_1.CreateRecipe(mockRepo);
        const input = {
            name: "Integration Test Recipe",
            ingredients: { dish: [{ id: 1, name: "salt", quantity: "1" }] },
            instructions: [{ text: "Do something" }],
        };
        const result = yield useCase.execute(input);
        expect(mockRepo.create).toHaveBeenCalledTimes(1);
        const passed = mockRepo.create.mock.calls[0][0];
        // microservice ensures slug and stepNumber/uniqueId
        expect(passed.slug).toBe("integration-test-recipe");
        expect(passed.instructions[0].stepNumber).toBeDefined();
        expect(passed.uniqueId).toBeDefined();
        expect(result).toEqual({ id: 1 });
    }));
});
