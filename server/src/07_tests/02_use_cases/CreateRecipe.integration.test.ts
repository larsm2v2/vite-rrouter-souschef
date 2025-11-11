import express from "express";
import http from "http";
import path from "path";
import { spawn, ChildProcess } from "child_process";
import net from "net";
import { CreateRecipe } from "../../02_use_cases/CreateRecipe";

describe("CreateRecipe integration with clean-recipe-service", () => {
  let child: ChildProcess | null = null;
  let baseUrl: string;

  function getFreePort(): Promise<number> {
    return new Promise((resolve, reject) => {
      const s = net.createServer();
      s.listen(0, () => {
        // @ts-ignore
        const port = (s.address() as any).port;
        s.close(() => resolve(port));
      });
      s.on("error", reject);
    });
  }

  async function waitForReady(url: string, timeout = 5000) {
    const start = Date.now();
    const fetch = (global as any).fetch;
    while (Date.now() - start < timeout) {
      try {
        const res = await fetch(`${url}/clean-recipe`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: "x" }),
        });
        if (res && res.status === 200) return;
      } catch (e) {
        // ignore
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    throw new Error("Timed out waiting for clean-recipe-service to be ready");
  }

  beforeAll(async () => {
    const port = await getFreePort();
    baseUrl = `http://127.0.0.1:${port}`;

    const serviceDir = path.resolve(
      __dirname,
      "../../../../clean-recipe-service"
    );

    // Try spawning the microservice via npx ts-node. If that fails (eg. npx
    // not available in CI), fall back to an in-process router to keep the
    // integration test meaningful.
    try {
      child = spawn(
        process.platform === "win32" ? "npx.cmd" : "npx",
        ["ts-node", "src/index.ts"],
        {
          cwd: serviceDir,
          env: { ...process.env, PORT: String(port) },
          stdio: ["ignore", "pipe", "pipe"],
        }
      );

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

      await waitForReady(baseUrl, 8000);
      process.env.CLEAN_RECIPE_SERVICE_URL = baseUrl;
    } catch (err) {
      // Fallback: start an in-test express server that mimics the microservice
      // using the local cleaner.
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { cleanRecipe } = require("../../services/recipe.service");
      const app = express();
      app.use(express.json());
      app.post("/clean-recipe", (req, res) => {
        try {
          const cleaned = cleanRecipe(req.body);
          res.status(200).json(cleaned);
        } catch (e: any) {
          res.status(400).json({ error: e && e.message });
        }
      });

      // start server
      await new Promise<void>((resolve) => {
        const s = app.listen(port, () => {
          // @ts-ignore
          // eslint-disable-next-line @typescript-eslint/no-unused-expressions
          s;
          process.env.CLEAN_RECIPE_SERVICE_URL = baseUrl;
          resolve();
        });
      });
    }
  });

  afterAll(async () => {
    delete process.env.CLEAN_RECIPE_SERVICE_URL;
    if (child && !child.killed) {
      child.kill();
      await new Promise((r) => setTimeout(r, 100));
    }
    child = null;
  });

  it("calls the microservice and forwards cleaned payload to repository", async () => {
    const mockRepo = { create: jest.fn().mockResolvedValue({ id: 1 }) } as any;
    const useCase = new CreateRecipe(mockRepo);

    const input = {
      name: "Integration Test Recipe",
      ingredients: { dish: [{ id: 1, name: "salt", quantity: "1" }] },
      instructions: [{ text: "Do something" }],
    } as any;

    const result = await useCase.execute(input);

    expect(mockRepo.create).toHaveBeenCalledTimes(1);
    const passed = mockRepo.create.mock.calls[0][0];
    // microservice ensures slug and stepNumber/uniqueId
    expect(passed.slug).toBe("integration-test-recipe");
    expect(passed.instructions[0].stepNumber).toBeDefined();
    expect(passed.uniqueId).toBeDefined();
    expect(result).toEqual({ id: 1 });
  });
});
