import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
} from "node:crypto";

function getKey() {
  const rawKey = process.env.FIELD_ENCRYPTION_KEY;

  if (!rawKey) {
    throw new Error("FIELD_ENCRYPTION_KEY is required for employee identifier encryption.");
  }

  return createHash("sha256").update(rawKey).digest();
}

function getHashPepper() {
  const rawPepper = process.env.FIELD_HASH_PEPPER?.trim();

  if (rawPepper) {
    return rawPepper;
  }

  const encryptionKeyFallback = process.env.FIELD_ENCRYPTION_KEY?.trim();

  if ((process.env.NODE_ENV ?? "development") !== "production" && encryptionKeyFallback) {
    return encryptionKeyFallback;
  }

  throw new Error("FIELD_HASH_PEPPER is required for deterministic sensitive value hashing.");
}

export function encryptSensitiveValue(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

export function decryptSensitiveValue(payload: string) {
  const buffer = Buffer.from(payload, "base64");
  const iv = buffer.subarray(0, 12);
  const tag = buffer.subarray(12, 28);
  const encrypted = buffer.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", getKey(), iv);
  decipher.setAuthTag(tag);

  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

export function hashSensitiveValue(value: string) {
  return createHmac("sha256", getHashPepper()).update(value).digest("hex");
}

export function hashSensitiveValueLegacy(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function generateInviteToken() {
  return randomBytes(32).toString("base64url");
}

export function hashInviteToken(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function maskIin(value: string) {
  return `********${value.slice(-4)}`;
}
