// src/utils/crypto.ts
import crypto from "crypto";

export function encryptToken(token: string): string {
  const iv = crypto.randomBytes(12); // 96-bit IV for AES-GCM
  const envKey = process.env.ENCRYPTION_KEY || process.env.DB_ENCRYPTION_KEY;
  if (!envKey) {
    throw new Error(
      "Missing encryption key: set ENCRYPTION_KEY or DB_ENCRYPTION_KEY in environment"
    );
  }
  const cipher = crypto.createCipheriv(
    "aes-256-gcm",
    Buffer.from(envKey, "hex"),
    iv
  );
  return `${iv.toString("hex")}:${cipher.update(
    token,
    "utf8",
    "hex"
  )}${cipher.final("hex")}:${cipher.getAuthTag().toString("hex")}`;
}

export function decryptToken(encrypted: string): string {
  const [ivHex, content, authTag] = encrypted.split(":");
  const envKey = process.env.ENCRYPTION_KEY || process.env.DB_ENCRYPTION_KEY;
  if (!envKey) {
    throw new Error(
      "Missing encryption key: set ENCRYPTION_KEY or DB_ENCRYPTION_KEY in environment"
    );
  }
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    Buffer.from(envKey, "hex"),
    Buffer.from(ivHex, "hex")
  );
  decipher.setAuthTag(Buffer.from(authTag, "hex"));
  return `${decipher.update(content, "hex", "utf8")}${decipher.final("utf8")}`;
}
