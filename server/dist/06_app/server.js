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
        yield (0, database_1.ensureDatabaseInitialized)();
        const PORT = process.env.PORT || 8000;
        index_1.app.listen(PORT, () => {
            console.log(`✅ Server running on port ${PORT}`);
        });
    });
}
