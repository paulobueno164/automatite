import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createSession, hashPassword } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();
  if (typeof email !== "string" || typeof password !== "string" || !email.includes("@") || password.length < 6) {
    return NextResponse.json({ error: "E-mail válido e senha de ao menos 6 caracteres são obrigatórios." }, { status: 400 });
  }
  const normalized = email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email: normalized } });
  if (existing) {
    return NextResponse.json({ error: "Já existe uma conta com esse e-mail." }, { status: 409 });
  }
  const user = await prisma.user.create({
    data: { email: normalized, passwordHash: await hashPassword(password) },
  });
  await createSession(user.id);
  return NextResponse.json({ ok: true });
}
