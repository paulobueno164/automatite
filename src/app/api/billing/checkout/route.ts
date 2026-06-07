import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getStripe, priceForTier } from "@/lib/stripe";
import { TIERS, TierId } from "@/lib/tiers";

// POST /api/billing/checkout — cria uma sessão de Checkout do Stripe para o tier escolhido.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const stripe = getStripe();
  if (!stripe) return NextResponse.json({ error: "Stripe não configurado" }, { status: 400 });

  const { tier } = await req.json();
  if (!tier || !(tier in TIERS)) return NextResponse.json({ error: "Plano inválido" }, { status: 400 });

  const priceId = priceForTier(tier as TierId);
  if (!priceId) return NextResponse.json({ error: `Price ID não configurado para o plano ${tier}.` }, { status: 400 });

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });

  // Cria/reutiliza o customer no Stripe.
  let customerId = dbUser?.stripeCustomerId ?? undefined;
  if (!customerId) {
    const customer = await stripe.customers.create({ email: user.email, metadata: { userId: user.id } });
    customerId = customer.id;
    await prisma.user.update({ where: { id: user.id }, data: { stripeCustomerId: customerId } });
  }

  const appUrl = process.env.APP_URL || "http://localhost:3000";
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appUrl}/billing?success=1`,
    cancel_url: `${appUrl}/billing?canceled=1`,
    // Liga a assinatura ao usuário/tier para o webhook saber o que atualizar.
    metadata: { userId: user.id, tier },
    subscription_data: { metadata: { userId: user.id, tier } },
  });

  return NextResponse.json({ url: session.url });
}
