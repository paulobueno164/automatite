import { NextRequest, NextResponse } from "next/server";
import { generateFlow } from "@/lib/anthropic";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

// POST /api/ai/generate — recebe a descrição e devolve o Flow gerado (Modelo 2)
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json();
  const description: string = body.description ?? "";
  if (!description.trim()) {
    return NextResponse.json({ error: "Descreva o que deseja automatizar." }, { status: 400 });
  }

  // Usa a chave do próprio usuário (BYOK), se configurada.
  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });

  try {
    const result = await generateFlow(
      { description, apps: body.apps, fields: body.fields },
      dbUser?.anthropicKey
    );
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: "Falha ao gerar o fluxo", detail: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
