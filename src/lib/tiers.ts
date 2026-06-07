export type TierId = "free" | "starter" | "pro" | "enterprise";

export type Tier = {
  id: TierId;
  name: string;
  price: string;
  priceValue: number;
  // null = ilimitado
  maxActiveAutomations: number | null;
  maxExecutionsPerMonth: number | null;
  features: string[];
};

export const TIERS: Record<TierId, Tier> = {
  free: {
    id: "free",
    name: "Free",
    price: "Grátis",
    priceValue: 0,
    maxActiveAutomations: 1,
    maxExecutionsPerMonth: 100,
    features: ["1 automação ativa", "100 execuções/mês", "Templates + criação por IA"],
  },
  starter: {
    id: "starter",
    name: "Starter",
    price: "$49/mês",
    priceValue: 49,
    maxActiveAutomations: 5,
    maxExecutionsPerMonth: 5000,
    features: ["5 automações ativas", "5.000 execuções/mês", "Integrações: e-mail, formulários, planilhas"],
  },
  pro: {
    id: "pro",
    name: "Pro",
    price: "$149/mês",
    priceValue: 149,
    maxActiveAutomations: 20,
    maxExecutionsPerMonth: 50000,
    features: ["20 automações ativas", "50.000 execuções/mês", "+ WhatsApp, Asana, Pipedrive, Slack"],
  },
  enterprise: {
    id: "enterprise",
    name: "Enterprise",
    price: "$499+/mês",
    priceValue: 499,
    maxActiveAutomations: null,
    maxExecutionsPerMonth: null,
    features: ["Automações ilimitadas", "Execuções ilimitadas", "Integrações customizadas", "Suporte prioritário"],
  },
};

export function getTier(id: string): Tier {
  return TIERS[(id as TierId)] ?? TIERS.free;
}

/** Início do mês atual (UTC) — usado para contar execuções do ciclo. */
export function startOfMonth(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}
