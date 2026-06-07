import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

type Params = { params: { id: string } };

export async function PATCH(req: NextRequest, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const task = await prisma.internalTask.findUnique({ where: { id: params.id } });
  if (!task || task.userId !== user.id) return NextResponse.json({ error: "Não encontrada" }, { status: 404 });

  const { status } = await req.json();
  if (status !== "open" && status !== "done") {
    return NextResponse.json({ error: "Status inválido" }, { status: 400 });
  }

  const updated = await prisma.internalTask.update({ where: { id: params.id }, data: { status } });
  return NextResponse.json(updated);
}
