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
    // Bolt: Use Object.defineProperty to implement lazy decryption.
    // This avoids CPU-intensive AES decryption and JSON parsing for integrations that aren't used in the current flow.
    Object.defineProperty(map, row.provider, {
      get: () => {
        try {
          const decrypted = decryptJson<Credentials>(row.dataEnc);
          // Memoize the result so it's only decrypted once.
          Object.defineProperty(map, row.provider, { value: decrypted, enumerable: true });
          return decrypted;
        } catch {
          // credencial corrompida (ex.: ENCRYPTION_KEY mudou) — ignora
          return undefined;
        }
      },
      configurable: true,
      enumerable: true,
    });
  }
  return map;
}
