import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getTier, startOfMonth } from "@/lib/tiers";
import { isStripeEnabled } from "@/lib/stripe";
import { BillingPlans } from "@/components/BillingPlans";

export const dynamic = "force-dynamic";

export default async function BillingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const tier = getTier(user.tier);
  const [activeCount, execThisMonth] = await Promise.all([
    prisma.automation.count({ where: { userId: user.id, active: true } }),
    prisma.execution.count({
      where: { automation: { userId: user.id }, createdAt: { gte: startOfMonth() } },
    }),
  ]);

  const fmt = (n: number | null) => (n === null ? "∞" : n.toLocaleString("pt-BR"));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Planos</h1>
        <p className="text-sm text-slate-500">Escolha o plano que cabe no seu uso. Troque quando quiser.</p>
      </div>

      <div className="card grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-sm font-medium text-slate-500">Automações ativas</p>
          <p className="text-xl font-semibold">
            {activeCount} / {fmt(tier.maxActiveAutomations)}
          </p>
        </div>
        <div>
          <p className="text-sm font-medium text-slate-500">Execuções este mês</p>
          <p className="text-xl font-semibold">
            {execThisMonth.toLocaleString("pt-BR")} / {fmt(tier.maxExecutionsPerMonth)}
          </p>
        </div>
      </div>

      <BillingPlans currentTier={user.tier} stripeEnabled={isStripeEnabled()} />

      <p className="text-xs text-slate-400">
        {isStripeEnabled()
          ? "Pagamentos processados pelo Stripe. Ao assinar, você é levado ao checkout seguro."
          : "Stripe não configurado: a troca de plano é imediata e sem cobrança. Defina STRIPE_SECRET_KEY e os price IDs no .env para ativar a cobrança real."}
      </p>
    </div>
  );
}
