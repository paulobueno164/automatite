import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// POST /api/settings/key — salva a chave própria (BYOK) do usuário
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { anthropicKey } = await req.json();
  const key = typeof anthropicKey === "string" ? anthropicKey.trim() : "";
  if (!key.startsWith("sk-ant-")) {
    return NextResponse.json({ error: "A chave deve começar com 'sk-ant-'." }, { status: 400 });
  }
  await prisma.user.update({ where: { id: user.id }, data: { anthropicKey: key } });
  return NextResponse.json({ ok: true });
}

// DELETE /api/settings/key — remove a chave própria (volta a usar a da plataforma)
export async function DELETE() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  await prisma.user.update({ where: { id: user.id }, data: { anthropicKey: null } });
  return NextResponse.json({ ok: true });
}
