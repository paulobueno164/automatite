"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Flow } from "@/lib/flow-types";
import { FlowPreview } from "./FlowPreview";

export function AiBuilder() {
  const router = useRouter();
  const [description, setDescription] = useState("");
  const [apps, setApps] = useState("");
  const [fields, setFields] = useState("");

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [flow, setFlow] = useState<Flow | null>(null);
  const [usedAI, setUsedAI] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setError(null);
    setLoading(true);
    setFlow(null);
    try {
      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description, apps, fields }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Falha ao gerar");
      setFlow(data.flow);
      setUsedAI(data.usedAI);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro");
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    if (!flow) return;
    setSaving(true);
    try {
      const res = await fetch("/api/automations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flow, source: "ai" }),
      });
      const created = await res.json();
      if (!res.ok) throw new Error(created.error ?? "Falha ao salvar");
      router.push(`/automations/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro");
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="card space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium">O que você quer automatizar?</label>
          <textarea
            className="input min-h-[120px]"
            placeholder="Ex.: Quando recebo um lead pelo formulário, quero criar um contato no Pipedrive, registrar numa planilha e enviar um e-mail de boas-vindas."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Quais apps você usa? (opcional)</label>
          <input className="input" placeholder="Gmail, Pipedrive, Google Sheets…" value={apps} onChange={(e) => setApps(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Dados importantes? (opcional)</label>
          <input className="input" placeholder="nome, email, empresa, telefone…" value={fields} onChange={(e) => setFields(e.target.value)} />
        </div>
        <button onClick={generate} disabled={loading || !description.trim()} className="btn-primary w-full">
          {loading ? "Gerando fluxo…" : "✨ Gerar automação"}
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>

      <div className="card">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">Pré-visualização</h2>
        {!flow ? (
          <p className="text-sm text-slate-400">O fluxo gerado aparecerá aqui. Revise antes de ativar.</p>
        ) : (
          <div className="space-y-4">
            {!usedAI && (
              <p className="rounded bg-amber-50 p-2 text-xs text-amber-700">
                Modo demonstração (sem ANTHROPIC_API_KEY). Configure a chave no <code>.env</code> para gerar fluxos reais.
              </p>
            )}
            <FlowPreview flow={flow} />
            <button onClick={save} disabled={saving} className="btn-primary w-full">
              {saving ? "Salvando…" : "Salvar automação"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
