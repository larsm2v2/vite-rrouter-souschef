import db from "../../05_frameworks/database/connection";

export interface OcrJob {
  id: number;
  jobId: string;
  userId?: number;
  status: "pending" | "processing" | "completed" | "failed";
  filePaths?: string[];
  ocrText?: string;
  result?: any;
  error?: string;
  processingTimeMs?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateOcrJobInput {
  jobId: string;
  userId?: number;
  filePaths?: string[];
  ocrText?: string;
}

export interface UpdateOcrJobInput {
  status?: "pending" | "processing" | "completed" | "failed";
  ocrText?: string;
  result?: any;
  error?: string;
  processingTimeMs?: number;
}

export class OcrJobRepository {
  async create(input: CreateOcrJobInput): Promise<OcrJob> {
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

    const result = await db.query(query, values);
    return this.mapRow(result.rows[0]);
  }

  async findByJobId(jobId: string): Promise<OcrJob | null> {
    const query = `SELECT * FROM ocr_jobs WHERE job_id = $1`;
    const result = await db.query(query, [jobId]);

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRow(result.rows[0]);
  }

  async findByUserId(userId: number, limit = 50): Promise<OcrJob[]> {
    const query = `
      SELECT * FROM ocr_jobs 
      WHERE user_id = $1 
      ORDER BY created_at DESC 
      LIMIT $2
    `;
    const result = await db.query(query, [userId, limit]);

    return result.rows.map((row) => this.mapRow(row));
  }

  async update(jobId: string, input: UpdateOcrJobInput): Promise<OcrJob | null> {
    const updates: string[] = [];
    const values: any[] = [];
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

    const result = await db.query(query, values);

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRow(result.rows[0]);
  }

  async deleteOldJobs(daysOld = 30): Promise<number> {
    const query = `
      DELETE FROM ocr_jobs 
      WHERE created_at < NOW() - INTERVAL '${daysOld} days'
    `;
    const result = await db.query(query);
    return result.rowCount || 0;
  }

  private mapRow(row: any): OcrJob {
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

export const ocrJobRepository = new OcrJobRepository();
