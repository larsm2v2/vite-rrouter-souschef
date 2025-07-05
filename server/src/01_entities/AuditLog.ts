import { EntitySchema } from "typeorm";

export interface AuditLog {
  id: number;
  userId?: number;
  action: string;
  endpoint: string;
  ipAddress: string;
  userAgent?: string;
  statusCode: number;
  metadata?: Record<string, any>;
  timestamp: Date;
}
