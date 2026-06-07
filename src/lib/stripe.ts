import Stripe from "stripe";
import { TierId } from "./tiers";

let cached: Stripe | null | undefined;

/** Instância do Stripe, ou null se não configurado (modo sem cobrança). */
export function getStripe(): Stripe | null {
  if (cached !== undefined) return cached;
  const key = process.env.STRIPE_SECRET_KEY;
  cached = key ? new Stripe(key) : null;
  return cached;
}

export function isStripeEnabled(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}

/** Mapa tier -> price ID (do .env). Free não tem preço. */
export function priceForTier(tier: TierId): string | null {
  switch (tier) {
    case "starter":
      return process.env.STRIPE_PRICE_STARTER || null;
    case "pro":
      return process.env.STRIPE_PRICE_PRO || null;
    case "enterprise":
      return process.env.STRIPE_PRICE_ENTERPRISE || null;
    default:
      return null;
  }
}

/** Mapa reverso price ID -> tier (usado no webhook). */
export function tierForPrice(priceId: string): TierId | null {
  if (priceId && priceId === process.env.STRIPE_PRICE_STARTER) return "starter";
  if (priceId && priceId === process.env.STRIPE_PRICE_PRO) return "pro";
  if (priceId && priceId === process.env.STRIPE_PRICE_ENTERPRISE) return "enterprise";
  return null;
}
