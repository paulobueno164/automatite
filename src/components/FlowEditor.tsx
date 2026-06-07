"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ACTION_CATALOG, Action, ActionType, Flow, Trigger } from "@/lib/flow-types";
import { ACTION_DEFAULTS } from "@/lib/action-schemas";
import { ActionConfigForm } from "./ActionConfigForm";
import { AutomationReadiness } from "./AutomationReadiness";
import { useDeepLinkScroll } from "./useDeepLinkScroll";
import { getAutomationReadiness, ReadinessContext } from "@/lib/automation-readiness";

const CRON_PRESETS = [
  { value: "*/5 * * * *", label: "A cada 5 minutos" },
  { value: "0 * * * *", label: "A cada hora" },
  { value: "0 9 * * *", label: "Todo dia às 9h" },
  { value: "0 18 * * *", label: "Todo dia às 18h" },
  { value: "0 9 * * 1", label: "Toda segunda às 9h" },
  { value: "0 9 1 * *", label: "Dia 1º do mês às 9h" },
];

const TRIGGER_OPTIONS: { value: Trigger["type"]; label: string }[] = [
  { value: "webhook", label: "Webhook / chamada externa" },
  { value: "form_submission", label: "Formulário recebido" },
  { value: "schedule", label: "Agendamento (cron)" },
];

const ACTION_TYPES = Object.keys(ACTION_CATALOG) as ActionType[];

type EditAction = {
  type: ActionType;
  label: string;
  params: Record<string, unknown>;
};

export function FlowEditor({
  id,
  initialFlow,
  readinessCtx,
}: {
  id: string;
  initialFlow: Flow;
  readinessCtx: ReadinessContext;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialFlow.name);
  const [description, setDescription] = useState(initialFlow.description ?? "");
  const [category, setCategory] = useState(initialFlow.category ?? "geral");
  const [triggerType, setTriggerType] = useState<Trigger["type"]>(initialFlow.trigger.type);
  const [cron, setCron] = useState<string>(String(initialFlow.trigger.config?.cron ?? "0 9 * * *"));
  const [actions, setActions] = useState<EditAction[]>(
    initialFlow.actions.map((a) => ({ type: a.type, label: a.label ?? "", params: { ...ACTION_DEFAULTS[a.type], ...a.params } }))
  );

  useDeepLinkScroll();

  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const baseTriggerConfig = { ...(initialFlow.trigger.config ?? {}) };
  const draftFlow: Flow = {
    name,
    description,
    category,
    trigger: {
      type: triggerType,
      config: triggerType === "schedule" ? { ...baseTriggerConfig, cron } : baseTriggerConfig,
    },
    actions: actions.map<Action>((a) => ({ type: a.type, label: a.label, params: a.params })),
  };

  const readiness = getAutomationReadiness(draftFlow, readinessCtx, id);

  function updateAction(i: number, patch: Partial<EditAction>) {
    setActions((prev) => prev.map((a, idx) => (idx === i ? { ...a, ...patch } : a)));
  }

  function changeActionType(i: number, type: ActionType) {
    setActions((prev) =>
      prev.map((a, idx) =>
        idx === i ? { ...a, type, params: { ...ACTION_DEFAULTS[type] }, label: a.label || ACTION_CATALOG[type].title } : a
      )
    );
  }

  function addAction() {
    setActions((prev) => [...prev, { type: "log", label: "Nova ação", params: { ...ACTION_DEFAULTS.log } }]);
  }

  function removeAction(i: number) {
    setActions((prev) => prev.filter((_, idx) => idx !== i));
  }

  function move(from: number, to: number) {
    if (to < 0 || to >= actions.length) return;
    setActions((prev) => {
      const copy = [...prev];
      const [item] = copy.splice(from, 1);
      copy.splice(to, 0, item);
      return copy;
    });
  }

  async function save() {
    setError(null);
    if (!name.trim()) return setError("Dê um nome à automação.");
    if (actions.length === 0) return setError("Adicione ao menos uma ação.");

    setSaving(true);
    try {
      const res = await fetch(`/api/automations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flow: draftFlow }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Falha ao salvar");
      router.push(`/automations/${id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro");
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <AutomationReadiness readiness={readiness} />

      <div className="card space-y-3">
        <div>
          <label className="mb-1 block text-sm font-medium">Nome</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Descrição</label>
          <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Categoria</label>
          <input className="input" value={category} onChange={(e) => setCategory(e.target.value)} />
        </div>
      </div>

      <div className="card space-y-3">
        <h2 className="font-semibold">Gatilho</h2>
        <select className="input" value={triggerType} onChange={(e) => setTriggerType(e.target.value as Trigger["type"])}>
          {TRIGGER_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {triggerType === "schedule" && (
          <div className="space-y-2">
            <label className="block text-sm font-medium">Frequência</label>
            <select
              className="input"
              value={CRON_PRESETS.some((p) => p.value === cron) ? cron : ""}
              onChange={(e) => e.target.value && setCron(e.target.value)}
            >
              {CRON_PRESETS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
              <option value="">Personalizado…</option>
            </select>
            <label className="block text-xs text-slate-500">Expressão cron</label>
            <input className="input font-mono" value={cron} onChange={(e) => setCron(e.target.value)} placeholder="0 9 * * *" />
            <p className="text-xs text-slate-400">Fuso: America/Sao_Paulo. Formato: minuto hora dia mês dia-da-semana.</p>
          </div>
        )}
        {triggerType !== "schedule" && (
          <p className="text-xs text-slate-400">
            Após salvar, use o link do formulário na página da automação — ou compartilhe com clientes. Campos viram placeholders como {"{nome}"} e {"{email}"}.
          </p>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Ações</h2>
          <button onClick={addAction} className="btn-ghost text-sm">
            + Adicionar ação
          </button>
        </div>

        {actions.map((action, ai) => (
          <div
            key={ai}
            draggable
            onDragStart={() => setDragIndex(ai)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (dragIndex !== null && dragIndex !== ai) move(dragIndex, ai);
              setDragIndex(null);
            }}
            id={`action-${ai}`}
            className={`card scroll-mt-24 space-y-4 ${dragIndex === ai ? "opacity-50" : ""}`}
          >
            <div className="flex items-center gap-2">
              <span className="cursor-grab text-slate-400" title="Arraste para reordenar">
                ⠿
              </span>
              <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                {ai + 1}
              </span>
              <select className="input flex-1" value={action.type} onChange={(e) => changeActionType(ai, e.target.value as ActionType)}>
                {ACTION_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {ACTION_CATALOG[t].title}
                  </option>
                ))}
              </select>
              <button onClick={() => move(ai, ai - 1)} className="btn-ghost px-2 py-1" title="Subir">
                ↑
              </button>
              <button onClick={() => move(ai, ai + 1)} className="btn-ghost px-2 py-1" title="Descer">
                ↓
              </button>
              <button onClick={() => removeAction(ai)} className="px-2 py-1 text-sm text-red-600 hover:underline">
                Remover
              </button>
            </div>

            <input
              className="input text-sm"
              placeholder="Nome desta etapa (ex: E-mail de boas-vindas)"
              value={action.label}
              onChange={(e) => updateAction(ai, { label: e.target.value })}
            />

            <ActionConfigForm
              actionIndex={ai}
              type={action.type}
              params={action.params}
              integrationHints={readinessCtx.integrationHints}
              onChange={(params) => updateAction(ai, { params })}
            />
          </div>
        ))}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button onClick={save} disabled={saving} className="btn-primary">
          {saving ? "Salvando…" : "Salvar fluxo"}
        </button>
        <button onClick={() => router.push(`/automations/${id}`)} className="btn-ghost">
          Cancelar
        </button>
      </div>
    </div>
  );
}
