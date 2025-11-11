import crypto from "crypto";

interface PasswordHash {
  hash: string;
  salt: string;
}

export async function hashPassword(password: string): Promise<PasswordHash> {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = await pbkdf2Hash(password, salt);
  return { hash, salt };
}

export async function comparePassword(
  password: string,
  storedHash: string,
  salt: string
): Promise<boolean> {
  const hash = await pbkdf2Hash(password, salt);
  return crypto.timingSafeEqual(
    Buffer.from(hash, "hex"),
    Buffer.from(storedHash, "hex")
  );
}

async function pbkdf2Hash(password: string, salt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(password, salt, 100000, 64, "sha512", (err, derivedKey) => {
      if (err) reject(err);
      resolve(derivedKey.toString("hex"));
    });
  });
}
