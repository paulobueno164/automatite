import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { generateApiKey } from "@/lib/api-key-auth";

/** POST — gera nova chave de API para exportar o CRM. */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { name } = await req.json().catch(() => ({}));
  const { raw, hash, prefix } = generateApiKey();

  await prisma.apiKey.create({
    data: { userId: user.id, name: name?.trim() || "Chave padrão", keyHash: hash, keyPrefix: prefix },
  });

  return NextResponse.json({ key: raw, prefix, message: "Copie agora — a chave não será exibida novamente." });
}

/** DELETE — revoga todas as chaves ou uma específica (?id=) */
export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id");
  if (id) {
    await prisma.apiKey.deleteMany({ where: { id, userId: user.id } });
  } else {
    await prisma.apiKey.deleteMany({ where: { userId: user.id } });
  }
  return NextResponse.json({ ok: true });
}
