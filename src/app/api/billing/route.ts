import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { TIERS, TierId } from "@/lib/tiers";

// POST /api/billing — troca o plano do usuário.
// MVP: troca direta (sem pagamento). Integrar Stripe Checkout aqui depois.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { tier } = await req.json();
  if (!tier || !(tier in TIERS)) {
    return NextResponse.json({ error: "Plano inválido" }, { status: 400 });
  }
  await prisma.user.update({ where: { id: user.id }, data: { tier: tier as TierId } });
  return NextResponse.json({ ok: true, tier });
}
