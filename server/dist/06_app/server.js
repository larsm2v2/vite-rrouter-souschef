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
exports.startServer = startServer;
const index_1 = require("../05_frameworks/index");
const database_1 = require("./database");
function startServer() {
    return __awaiter(this, void 0, void 0, function* () {
        // Start listening immediately so the container becomes healthy for Cloud Run
        // even if database initialization takes time or briefly fails.
        const PORT = process.env.PORT || 8000;
        const server = index_1.app.listen(PORT, () => {
            console.log(`✅ Server running on port ${PORT}`);
        });
        // Initialize database in the background. If initialization fails, log the
        // error but keep the server running so Cloud Run health checks succeed and
        // we can surface errors via logs and retry logic.
        (0, database_1.ensureDatabaseInitialized)().catch((err) => {
            console.error("Database initialization failed (continuing to run):", err);
        });
        return server;
    });
}
