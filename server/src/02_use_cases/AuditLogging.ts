import pool from "../05_frameworks/database/connection";

export class LogAudit {
  async execute({
    userId,
    action,
    endpoint,
    ipAddress,
    userAgent,
    statusCode,
    metadata,
  }: {
    userId?: number;
    action: string;
    endpoint: string;
    ipAddress: string;
    userAgent?: string;
    statusCode: number;
    metadata: Record<string, any>;
  }): Promise<void> {
    await pool.query(
      `INSERT INTO audit_log (
        user_id, action, endpoint, ip_address, 
        user_agent, status_code, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        userId || null,
        action,
        endpoint,
        ipAddress,
        userAgent,
        statusCode,
        JSON.stringify(metadata),
      ]
    );
  }
}
