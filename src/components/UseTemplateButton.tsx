"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Flow } from "@/lib/flow-types";

export function UseTemplateButton({ flow }: { flow: Flow }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function use() {
    setLoading(true);
    try {
      const res = await fetch("/api/automations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flow, source: "template" }),
      });
      const created = await res.json();
      if (!res.ok) throw new Error(created.error ?? "Falha ao criar");
      router.push(`/automations/${created.id}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro");
      setLoading(false);
    }
  }

  return (
    <button onClick={use} disabled={loading} className="btn-primary w-full">
      {loading ? "Criando…" : "Usar este template"}
    </button>
  );
}
