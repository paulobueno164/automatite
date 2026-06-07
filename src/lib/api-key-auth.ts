import "server-only";
import { createHash, randomBytes } from "crypto";
import { NextRequest } from "next/server";
import { prisma } from "./db";

const PREFIX = "atk_";

export function generateApiKey(): { raw: string; hash: string; prefix: string } {
  const raw = PREFIX + randomBytes(24).toString("hex");
  const hash = hashApiKey(raw);
  const prefix = raw.slice(0, 12) + "…";
  return { raw, hash, prefix };
}

export function hashApiKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/** Autentica requisição da API externa via Bearer atk_... */
export async function authenticateApiKey(req: NextRequest): Promise<{ userId: string; keyId: string } | null> {
  const auth = req.headers.get("authorization") ?? "";
  const match = auth.match(/^Bearer\s+(.+)$/i);
  const raw = match?.[1]?.trim();
  if (!raw?.startsWith(PREFIX)) return null;

  const key = await prisma.apiKey.findUnique({ where: { keyHash: hashApiKey(raw) } });
  if (!key) return null;

  await prisma.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } });
  return { userId: key.userId, keyId: key.id };
}
