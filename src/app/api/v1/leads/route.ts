import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { authenticateApiKey } from "@/lib/api-key-auth";
import { leadToApi } from "@/lib/crm";

/** GET /api/v1/leads — lista leads do CRM (API externa). */
export async function GET(req: NextRequest) {
  const auth = await authenticateApiKey(req);
  if (!auth) return NextResponse.json({ error: "Não autorizado. Use Authorization: Bearer atk_..." }, { status: 401 });

  const status = req.nextUrl.searchParams.get("status") ?? undefined;
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? 50), 200);
  const offset = Number(req.nextUrl.searchParams.get("offset") ?? 0);

  const where = { userId: auth.userId, ...(status ? { status } : {}) };
  const [leads, total] = await Promise.all([
    prisma.lead.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.lead.count({ where }),
  ]);

  return NextResponse.json({
    total,
    limit,
    offset,
    leads: leads.map(leadToApi),
  });
}
