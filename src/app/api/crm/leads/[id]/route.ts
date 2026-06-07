import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { addLeadEvent } from "@/lib/crm";

type Params = { params: { id: string } };

export async function PATCH(req: NextRequest, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const lead = await prisma.lead.findFirst({ where: { id: params.id, userId: user.id } });
  if (!lead) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

  const { status } = await req.json();
  if (!status) return NextResponse.json({ error: "Status ausente" }, { status: 400 });

  const updated = await prisma.lead.update({ where: { id: params.id }, data: { status } });
  await addLeadEvent({
    leadId: params.id,
    type: "status_change",
    title: "Status alterado",
    detail: `${lead.status} → ${status}`,
  });

  return NextResponse.json(updated);
}
