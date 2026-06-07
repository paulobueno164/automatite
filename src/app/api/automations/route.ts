import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { FlowSchema } from "@/lib/flow-types";

// GET /api/automations — lista as automações do usuário logado
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const items = await prisma.automation.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { executions: true } } },
  });
  return NextResponse.json(items);
}

// POST /api/automations — cria uma automação a partir de um Flow
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json();
  const parsed = FlowSchema.safeParse(body.flow);
  if (!parsed.success) {
    return NextResponse.json({ error: "Fluxo inválido", details: parsed.error.flatten() }, { status: 400 });
  }
  const flow = parsed.data;
  const source: string = body.source ?? "manual";

  const created = await prisma.automation.create({
    data: {
      userId: user.id,
      name: flow.name,
      description: flow.description,
      category: flow.category,
      source,
      triggerJson: JSON.stringify(flow.trigger),
      actionsJson: JSON.stringify(flow.actions),
      active: false,
    },
  });
  return NextResponse.json(created, { status: 201 });
}
