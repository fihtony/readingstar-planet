/**
 * AES-256-GCM authenticated encryption for storing sensitive credentials in the database.
 *
 * Key management:
 *   - The encryption key is stored in the environment variable READINGSTAR_ENCRYPTION_KEY.
 *   - The value must be a 64-character hex string (32 bytes / 256 bits).
 *   - Generate one with: openssl rand -hex 32
 *
 *   macOS:  Add to ~/.zshrc  →  export READINGSTAR_ENCRYPTION_KEY="<hex>"
 *           Or load from macOS Keychain via your deployment tooling.
 *   Linux:  Add to /etc/environment or your service manager's EnvironmentFile.
 *
 * Encrypted blob format (base64-encoded):
 *   [ version (1 byte) | iv (12 bytes) | authTag (16 bytes) | ciphertext ]
 *   Version 1 = AES-256-GCM
 *
 * If READINGSTAR_ENCRYPTION_KEY is not set, encrypt/decrypt are no-ops that
 * log a warning.  This keeps the app functional during initial setup but
 * credentials are stored in plaintext until the key is configured.
 */

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const VERSION = 1;
const ALG = "aes-256-gcm";
const IV_LEN = 12;   // 96-bit IV recommended for GCM
const TAG_LEN = 16;  // 128-bit auth tag

function getKey(): Buffer | null {
  const hex = process.env.READINGSTAR_ENCRYPTION_KEY;
  if (!hex) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "[encryption] READINGSTAR_ENCRYPTION_KEY must be set in production. " +
        "Generate one with: openssl rand -hex 32"
      );
    }
    console.warn(
      "[encryption] READINGSTAR_ENCRYPTION_KEY is not set. " +
      "Sensitive credentials will be stored unencrypted. " +
      "Run: openssl rand -hex 32  and set the result as READINGSTAR_ENCRYPTION_KEY."
    );
    return null;
  }
  if (hex.length !== 64 || !/^[0-9a-fA-F]{64}$/.test(hex)) {
    console.error(
      "[encryption] READINGSTAR_ENCRYPTION_KEY must be a 64-character hex string (32 bytes). " +
      "Generate one with: openssl rand -hex 32"
    );
    return null;
  }
  return Buffer.from(hex, "hex");
}

/**
 * Encrypt a plaintext string.
 * Returns a base64-encoded string with version, IV, auth tag, and ciphertext.
 * Falls back to plaintext if the key is not configured.
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  if (!key) {
    return plaintext; // graceful degradation
  }

  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALG, key, iv);

  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  // Pack: version(1) + iv(12) + authTag(16) + ciphertext
  const blob = Buffer.alloc(1 + IV_LEN + TAG_LEN + ciphertext.length);
  blob.writeUInt8(VERSION, 0);
  iv.copy(blob, 1);
  authTag.copy(blob, 1 + IV_LEN);
  ciphertext.copy(blob, 1 + IV_LEN + TAG_LEN);

  return blob.toString("base64");
}

/**
 * Decrypt a value produced by encrypt().
 * Returns the original plaintext, or the input unchanged if decryption fails / key missing.
 */
export function decrypt(value: string): string {
  const key = getKey();
  if (!key) {
    return value; // stored unencrypted
  }

  let blob: Buffer;
  try {
    blob = Buffer.from(value, "base64");
  } catch {
    return value; // not base64 → treat as plaintext
  }

  // Must have at least version + iv + authTag
  if (blob.length < 1 + IV_LEN + TAG_LEN) {
    return value; // legacy plaintext or wrong format
  }

  const version = blob.readUInt8(0);
  if (version !== VERSION) {
    console.warn(`[encryption] Unknown blob version ${version}, returning raw value.`);
    return value;
  }

  try {
    const iv = blob.subarray(1, 1 + IV_LEN);
    const authTag = blob.subarray(1 + IV_LEN, 1 + IV_LEN + TAG_LEN);
    const ciphertext = blob.subarray(1 + IV_LEN + TAG_LEN);

    const decipher = createDecipheriv(ALG, key, iv);
    decipher.setAuthTag(authTag);

    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  } catch {
    console.error("[encryption] Decryption failed (wrong key or corrupted data).");
    return value;
  }
}

/** Returns true when the value looks like an encrypted blob (base64 with version byte 1). */
export function isEncrypted(value: string): boolean {
  try {
    const blob = Buffer.from(value, "base64");
    return blob.length > 1 + IV_LEN + TAG_LEN && blob.readUInt8(0) === VERSION;
  } catch {
    return false;
  }
}
