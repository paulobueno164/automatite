import "server-only";
import { prisma } from "./db";
import { decryptJson } from "./crypto";
import { Credentials } from "./provider-catalog";

// Reexporta o catálogo para quem importar via integrations (lado servidor).
export * from "./provider-catalog";

/** Carrega e descriptografa as credenciais de todas as integrações de um usuário. */
export async function loadUserIntegrations(userId: string): Promise<Record<string, Credentials>> {
  const rows = await prisma.integration.findMany({ where: { userId } });
  const map: Record<string, Credentials> = {};
  for (const row of rows) {
    try {
      map[row.provider] = decryptJson<Credentials>(row.dataEnc);
    } catch {
      // credencial corrompida (ex.: ENCRYPTION_KEY mudou) — ignora
    }
  }
  return map;
}
