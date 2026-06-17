import { PrismaClient } from "@prisma/client";

// Evita criar múltiplas conexões durante o hot-reload do Next em dev.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrisma() {
  return new PrismaClient();
}

/** Recria o client se o schema mudou mas o singleton em dev ficou desatualizado. */
function getPrisma(): PrismaClient {
  const cached = globalForPrisma.prisma;
  if (cached && "lead" in cached && "apiKey" in cached) return cached;
  // @ts-ignore - cached is checked to exists
  if (cached) void cached.$disconnect().catch(() => {});
  const client = createPrisma();
  if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = client;
  return client;
}

export const prisma = getPrisma();
