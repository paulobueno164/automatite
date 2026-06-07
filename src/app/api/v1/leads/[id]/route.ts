import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { authenticateApiKey } from "@/lib/api-key-auth";
import { leadToApi } from "@/lib/crm";

type Params = { params: { id: string } };

/** GET /api/v1/leads/:id — detalhe do lead com histórico. */
export async function GET(req: NextRequest, { params }: Params) {
  const auth = await authenticateApiKey(req);
  if (!auth) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const lead = await prisma.lead.findFirst({
    where: { id: params.id, userId: auth.userId },
    include: { events: { orderBy: { createdAt: "desc" } } },
  });
  if (!lead) return NextResponse.json({ error: "Lead não encontrado" }, { status: 404 });

  return NextResponse.json(leadToApi(lead));
}
