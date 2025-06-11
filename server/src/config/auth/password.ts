import crypto from 'crypto';

interface PasswordHash {
  hash: string;
  salt: string;
}

/**
 * Generates a secure hash for a password along with a random salt
 * 
 * @param password The plain text password to hash
 * @returns Object containing the hash and salt
 */
export async function hashPassword(password: string): Promise<PasswordHash> {
  // Generate a random salt
  const salt = crypto.randomBytes(16).toString('hex');
  
  // Hash the password with the salt using PBKDF2
  const hash = await pbkdf2Hash(password, salt);
  
  return { hash, salt };
}

/**
 * Compares a password against a stored hash and salt
 * 
 * @param password The plain text password to check
 * @param storedHash The previously stored hash
 * @param salt The salt used for the stored hash
 * @returns Boolean indicating if the password matches
 */
export async function comparePassword(
  password: string,
  storedHash: string,
  salt: string
): Promise<boolean> {
  // Hash the input password with the same salt
  const hash = await pbkdf2Hash(password, salt);
  
  // Use timing-safe comparison to prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(hash, 'hex'),
    Buffer.from(storedHash, 'hex')
  );
}

/**
 * Helper function that performs PBKDF2 hashing
 */
async function pbkdf2Hash(password: string, salt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(
      password,
      salt,
      100000,  // 100,000 iterations - adjust as needed for security/performance
      64,      // 64 bytes (512 bits) key length
      'sha512',
      (err, derivedKey) => {
        if (err) reject(err);
        resolve(derivedKey.toString('hex'));
      }
    );
  });
} 