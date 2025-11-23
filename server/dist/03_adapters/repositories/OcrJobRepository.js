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
exports.ocrJobRepository = exports.OcrJobRepository = void 0;
const connection_1 = __importDefault(require("../../05_frameworks/database/connection"));
class OcrJobRepository {
    create(input) {
        return __awaiter(this, void 0, void 0, function* () {
            const query = `
      INSERT INTO ocr_jobs (job_id, user_id, file_paths, ocr_text, status)
      VALUES ($1, $2, $3, $4, 'pending')
      RETURNING *
    `;
            const values = [
                input.jobId,
                input.userId || null,
                input.filePaths || [],
                input.ocrText || null,
            ];
            const result = yield connection_1.default.query(query, values);
            return this.mapRow(result.rows[0]);
        });
    }
    findByJobId(jobId) {
        return __awaiter(this, void 0, void 0, function* () {
            const query = `SELECT * FROM ocr_jobs WHERE job_id = $1`;
            const result = yield connection_1.default.query(query, [jobId]);
            if (result.rows.length === 0) {
                return null;
            }
            return this.mapRow(result.rows[0]);
        });
    }
    findByUserId(userId_1) {
        return __awaiter(this, arguments, void 0, function* (userId, limit = 50) {
            const query = `
      SELECT * FROM ocr_jobs 
      WHERE user_id = $1 
      ORDER BY created_at DESC 
      LIMIT $2
    `;
            const result = yield connection_1.default.query(query, [userId, limit]);
            return result.rows.map((row) => this.mapRow(row));
        });
    }
    update(jobId, input) {
        return __awaiter(this, void 0, void 0, function* () {
            const updates = [];
            const values = [];
            let paramIndex = 1;
            if (input.status !== undefined) {
                updates.push(`status = $${paramIndex++}`);
                values.push(input.status);
            }
            if (input.ocrText !== undefined) {
                updates.push(`ocr_text = $${paramIndex++}`);
                values.push(input.ocrText);
            }
            if (input.result !== undefined) {
                updates.push(`result = $${paramIndex++}`);
                values.push(JSON.stringify(input.result));
            }
            if (input.error !== undefined) {
                updates.push(`error = $${paramIndex++}`);
                values.push(input.error);
            }
            if (input.processingTimeMs !== undefined) {
                updates.push(`processing_time_ms = $${paramIndex++}`);
                values.push(input.processingTimeMs);
            }
            if (updates.length === 0) {
                return this.findByJobId(jobId);
            }
            values.push(jobId);
            const query = `
      UPDATE ocr_jobs 
      SET ${updates.join(", ")}
      WHERE job_id = $${paramIndex}
      RETURNING *
    `;
            const result = yield connection_1.default.query(query, values);
            if (result.rows.length === 0) {
                return null;
            }
            return this.mapRow(result.rows[0]);
        });
    }
    deleteOldJobs() {
        return __awaiter(this, arguments, void 0, function* (daysOld = 30) {
            const query = `
      DELETE FROM ocr_jobs 
      WHERE created_at < NOW() - INTERVAL '${daysOld} days'
    `;
            const result = yield connection_1.default.query(query);
            return result.rowCount || 0;
        });
    }
    mapRow(row) {
        return {
            id: row.id,
            jobId: row.job_id,
            userId: row.user_id,
            status: row.status,
            filePaths: row.file_paths,
            ocrText: row.ocr_text,
            result: row.result,
            error: row.error,
            processingTimeMs: row.processing_time_ms,
            createdAt: new Date(row.created_at),
            updatedAt: new Date(row.updated_at),
        };
    }
}
exports.OcrJobRepository = OcrJobRepository;
exports.ocrJobRepository = new OcrJobRepository();
