"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TIERS, TierId } from "@/lib/tiers";

export function BillingPlans({ currentTier, stripeEnabled }: { currentTier: string; stripeEnabled: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function select(tier: TierId) {
    setBusy(tier);
    try {
      // Com Stripe ativo, planos pagos vão pro Checkout. Free e o modo sem Stripe trocam direto.
      if (stripeEnabled && tier !== "free") {
        const res = await fetch("/api/billing/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tier }),
        });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error ?? "Falha");
        window.location.href = d.url;
        return;
      }
      const res = await fetch("/api/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Falha");
      }
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {Object.values(TIERS).map((tier) => {
        const isCurrent = tier.id === currentTier;
        return (
          <div
            key={tier.id}
            className={`card flex flex-col gap-3 ${isCurrent ? "border-brand-500 ring-2 ring-brand-100" : ""}`}
          >
            <div>
              <h3 className="text-lg font-semibold">{tier.name}</h3>
              <p className="text-2xl font-bold text-brand-700">{tier.price}</p>
            </div>
            <ul className="flex-1 space-y-1 text-sm text-slate-600">
              {tier.features.map((f, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-green-600">✓</span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            {isCurrent ? (
              <span className="badge justify-center bg-brand-100 py-2 text-brand-700">Plano atual</span>
            ) : (
              <button onClick={() => select(tier.id)} disabled={busy !== null} className="btn-primary">
                {busy === tier.id
                  ? "Aguarde…"
                  : stripeEnabled && tier.id !== "free"
                  ? "Assinar"
                  : "Selecionar"}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
