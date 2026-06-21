import { createCipheriv, createDecipheriv, randomBytes, createHash } from "crypto";

let cachedKey: Buffer | null = null;

/**
 * Criptografia simétrica AES-256-GCM para guardar credenciais de integração no banco.
 * A chave vem de ENCRYPTION_KEY (32 bytes em hex). Se ausente, deriva uma chave de dev
 * a partir de uma constante — NÃO use assim em produção.
 */
function getKey(): Buffer {
  if (cachedKey) return cachedKey;

  const hex = process.env.ENCRYPTION_KEY;
  if (hex && /^[0-9a-fA-F]{64}$/.test(hex)) {
    cachedKey = Buffer.from(hex, "hex");
    return cachedKey;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("ENCRYPTION_KEY critical failure: Not configured or invalid in production.");
  }
  // Fallback de desenvolvimento (inseguro). Mantém o app funcional sem configurar a chave.
  cachedKey = createHash("sha256").update("automatite-dev-fallback-key").digest();
  return cachedKey;
}

export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  // formato: iv.tag.ciphertext (base64)
  return [iv.toString("base64"), tag.toString("base64"), enc.toString("base64")].join(".");
}

export function decrypt(payload: string): string {
  const [ivB64, tagB64, dataB64] = payload.split(".");
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const data = Buffer.from(dataB64, "base64");
  const decipher = createDecipheriv("aes-256-gcm", getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

export function encryptJson(obj: unknown): string {
  return encrypt(JSON.stringify(obj));
}

export function decryptJson<T = Record<string, string>>(payload: string): T {
  return JSON.parse(decrypt(payload)) as T;
}
