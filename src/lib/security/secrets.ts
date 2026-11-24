import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const ENVELOPE_VERSION = "v1";
const IV_LENGTH = 12;

function getEncryptionKey(): Buffer {
  const encodedKey = process.env.RESELLER_ENCRYPTION_KEY;
  if (!encodedKey) {
    throw new Error("RESELLER_ENCRYPTION_KEY is required for encrypted secrets.");
  }

  const key = Buffer.from(encodedKey, "base64");
  if (
    key.byteLength !== 32 ||
    key.toString("base64").replace(/=+$/, "") !==
      encodedKey.trim().replace(/=+$/, "")
  ) {
    throw new Error("RESELLER_ENCRYPTION_KEY must be a base64-encoded 32-byte key.");
  }

  return key;
}

export function encryptSecret(secret: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(secret, "utf8"),
    cipher.final(),
  ]);

  return [
    ENVELOPE_VERSION,
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

export function decryptSecret(envelope: string): string {
  const [version, encodedIv, encodedTag, encodedCiphertext, ...extra] =
    envelope.split(".");
  if (
    version !== ENVELOPE_VERSION ||
    !encodedIv ||
    !encodedTag ||
    !encodedCiphertext ||
    extra.length > 0
  ) {
    throw new Error("Stored secret has an unsupported encryption envelope.");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    getEncryptionKey(),
    Buffer.from(encodedIv, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(encodedTag, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(encodedCiphertext, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export function fingerprintSecret(secret: string): string {
  return createHash("sha256").update(secret.trim(), "utf8").digest("hex");
}
