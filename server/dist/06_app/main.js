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
// Load environment variables first
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config(); // Load .env
dotenv_1.default.config({ path: ".env.local", override: true }); // Load .env.local (overrides .env)
// Ensure reflect-metadata and DI are initialized before importing application
require("reflect-metadata");
require("../04_factories/di"); // boot DI container and register services
const environment_1 = require("./environment");
const server_1 = require("./server");
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            (0, environment_1.validateEnvironment)();
            // Secrets are now mounted as environment variables in Cloud Run via --set-secrets,
            // so we don't need to fetch them at runtime. Commented out to speed up startup.
            // If you need runtime secret rotation, uncomment this block and ensure GCP_PROJECT is set.
            /*
            try {
              await startupCache();
              // Start a background refresh loop to pick up rotations periodically
              scheduleRefresh();
            } catch (e) {
              console.warn(
                "Warning: secret manager startup cache failed, continuing to start server:",
                e
              );
            }
            */
            yield (0, server_1.startServer)();
        }
        catch (error) {
            console.error("❌ Application failed to start:", error);
            process.exit(1);
        }
    });
}
main();
