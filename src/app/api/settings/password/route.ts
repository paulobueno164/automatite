import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, hashPassword, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/db";

/** POST — altera a senha da conta (somente o próprio usuário, com senha atual). */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { currentPassword, newPassword } = await req.json();
  if (typeof currentPassword !== "string" || typeof newPassword !== "string") {
    return NextResponse.json({ error: "Preencha a senha atual e a nova senha." }, { status: 400 });
  }
  if (newPassword.length < 6) {
    return NextResponse.json({ error: "A nova senha precisa ter pelo menos 6 caracteres." }, { status: 400 });
  }
  if (currentPassword === newPassword) {
    return NextResponse.json({ error: "A nova senha deve ser diferente da atual." }, { status: 400 });
  }

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
  if (!dbUser) return NextResponse.json({ error: "Conta não encontrada" }, { status: 404 });

  const valid = await verifyPassword(currentPassword, dbUser.passwordHash);
  if (!valid) {
    return NextResponse.json({ error: "Senha atual incorreta." }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(newPassword) },
  });

  return NextResponse.json({ ok: true, message: "Senha alterada com sucesso." });
}
