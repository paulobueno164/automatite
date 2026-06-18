"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ReadinessResult } from "@/lib/automation-readiness";
import { FormConfig } from "@/lib/form-config";
import { PublicForm } from "./PublicForm";

export function AutomationActions({
  id,
  name,
  description,
  initialActive,
  readiness,
  formUrl,
  webhookUrl,
  formConfig,
  isSchedule,
}: {
  id: string;
  name: string;
  description: string;
  initialActive: boolean;
  readiness: ReadinessResult;
  formUrl: string;
  webhookUrl: string;
  formConfig: FormConfig;
  isSchedule: boolean;
}) {
  const router = useRouter();
  const [active, setActive] = useState(initialActive);
  const [busy, setBusy] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);
  const [copiedType, setCopiedType] = useState<"form" | "webhook" | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const missing = readiness.items.filter((i) => i.status === "missing");

  async function toggleActive() {
    if (!active && !readiness.ready) {
      setTestError("Veja o checklist acima — falta configurar itens desta automação.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/automations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !active }),
      });
      const data = await res.json();
      setActive(data.active);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm("Excluir esta automação?")) return;
    await fetch(`/api/automations/${id}`, { method: "DELETE" });
    router.push("/");
  }

  async function handleCopy(text: string, type: "form" | "webhook") {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedType(type);
      setTimeout(() => setCopiedType(null), 2000);
    } catch {
      setTestError("Não foi possível copiar. Selecione o link manualmente.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Status</p>
            <p className="text-xs text-slate-500">
              {active ? "Ativa — pronta para receber envios." : "Inativa — ative para começar a usar."}
            </p>
          </div>
          <button
            onClick={toggleActive}
            disabled={busy || (!active && !readiness.ready)}
            className={active ? "btn-ghost" : "btn-primary"}
            title={!active && !readiness.ready ? "Configure os itens pendentes no checklist" : undefined}
          >
            {active ? "Desativar" : "Ativar"}
          </button>
        </div>

        {!isSchedule && (
          <div className="rounded-lg border border-brand-100 bg-brand-50/60 p-4 space-y-3">
            <div>
              <p className="text-sm font-medium text-brand-900">Como usar esta automação</p>
              <p className="text-xs text-brand-800/80">
                Compartilhe o link do formulário — qualquer pessoa preenche e a automação roda sozinha. Sem código, sem integração externa.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <code className="flex-1 overflow-x-auto rounded bg-white px-3 py-2 text-xs text-slate-700">{formUrl}</code>
              <button
                onClick={() => handleCopy(formUrl, "form")}
                className="btn-ghost shrink-0 text-sm"
                aria-label="Copiar link do formulário"
              >
                {copiedType === "form" ? "Copiado!" : "Copiar link"}
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              <a href={formUrl} target="_blank" rel="noreferrer" className="btn-primary text-sm">
                Abrir formulário ↗
              </a>
              <Link href={`/automations/${id}/form`} className="btn-ghost text-sm">
                Personalizar formulário
              </Link>
            </div>

            {!active && (
              <p className="text-xs text-amber-700">Ative a automação para o formulário público funcionar.</p>
            )}
          </div>
        )}
      </div>

      {!isSchedule && (
        <div className="card space-y-3">
          <p className="text-sm font-medium">Testar agora</p>
          <p className="text-xs text-slate-500">
            Preencha como se fosse um visitante do seu site. A automação precisa estar ativa.
          </p>

          {!readiness.ready && missing.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              <p className="mb-2 font-medium">Para testar, resolva nesta automação:</p>
              <ul className="space-y-1">
                {missing.map((item, i) => (
                  <li key={i} className="flex items-start justify-between gap-2">
                    <span>
                      <strong>Passo {item.actionIndex + 1}</strong> ({item.actionLabel}): {item.requirement}
                    </span>
                    {item.fixUrl && (
                      <Link href={item.fixUrl} className="shrink-0 font-medium text-brand-700 hover:underline">
                        {item.fixLabel ?? "Resolver"}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {testError && <p className="text-sm text-red-600">{testError}</p>}

          <PublicForm automationId={id} config={{ ...formConfig, title: name, description }} compact showTitle={false} />
        </div>
      )}

      <div className="card">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex w-full items-center justify-between text-sm font-medium text-slate-600"
        >
          <span>Avançado — webhook para desenvolvedores</span>
          <span className="text-slate-400">{showAdvanced ? "▲" : "▼"}</span>
        </button>
        {showAdvanced && (
          <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
            <p className="text-xs text-slate-500">POST com JSON nesta URL (para sites ou sistemas externos):</p>
            <div className="flex items-center gap-2">
              <code className="block flex-1 overflow-x-auto rounded bg-slate-50 p-2 text-xs text-slate-700">
                {webhookUrl}
              </code>
              <button
                onClick={() => handleCopy(webhookUrl, "webhook")}
                className="btn-ghost shrink-0 px-3 py-1.5 text-xs"
                aria-label="Copiar URL do webhook"
              >
                {copiedType === "webhook" ? "Copiado!" : "Copiar"}
              </button>
            </div>
          </div>
        )}
      </div>

      <button onClick={remove} className="text-sm text-red-500 hover:underline">
        Excluir automação
      </button>
    </div>
  );
}
