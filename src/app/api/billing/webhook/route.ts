import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { prisma } from "@/lib/db";
import { getStripe, tierForPrice } from "@/lib/stripe";
import { TierId } from "@/lib/tiers";

// O webhook precisa do corpo cru (sem parse) para validar a assinatura.
export const dynamic = "force-dynamic";

// POST /api/billing/webhook — recebe eventos do Stripe e atualiza o plano do usuário.
export async function POST(req: NextRequest) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) return NextResponse.json({ error: "Stripe não configurado" }, { status: 400 });

  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "Sem assinatura" }, { status: 400 });

  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, secret);
  } catch (err) {
    return NextResponse.json({ error: `Assinatura inválida: ${err instanceof Error ? err.message : err}` }, { status: 400 });
  }

  async function setTier(userId: string | undefined | null, tier: TierId) {
    if (!userId) return;
    await prisma.user.update({ where: { id: userId }, data: { tier } }).catch(() => {});
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const s = event.data.object as Stripe.Checkout.Session;
      await setTier(s.metadata?.userId, (s.metadata?.tier as TierId) ?? "free");
      break;
    }
    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      // Tier pela metadata ou pelo price ativo.
      const priceId = sub.items.data[0]?.price?.id ?? "";
      const tier = (sub.metadata?.tier as TierId) || tierForPrice(priceId) || "free";
      const userId = sub.metadata?.userId ?? (await userIdByCustomer(sub.customer));
      // Assinatura cancelada/expirada volta para free.
      await setTier(userId, sub.status === "active" || sub.status === "trialing" ? tier : "free");
      break;
    }
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const userId = sub.metadata?.userId ?? (await userIdByCustomer(sub.customer));
      await setTier(userId, "free");
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}

async function userIdByCustomer(customer: string | Stripe.Customer | Stripe.DeletedCustomer | null): Promise<string | null> {
  const id = typeof customer === "string" ? customer : customer?.id;
  if (!id) return null;
  const u = await prisma.user.findFirst({ where: { stripeCustomerId: id }, select: { id: true } });
  return u?.id ?? null;
}
