"use client";

import { ActionType } from "@/lib/flow-types";
import { getVisibleFields, IntegrationHints, isFieldRequired } from "@/lib/action-schemas";

export function ActionConfigForm({
  actionIndex,
  type,
  params,
  onChange,
  integrationHints = {},
}: {
  actionIndex: number;
  type: ActionType;
  params: Record<string, unknown>;
  onChange: (params: Record<string, unknown>) => void;
  integrationHints?: IntegrationHints;
}) {
  const fields = getVisibleFields(type, params);

  function setField(key: string, value: string) {
    onChange({ ...params, [key]: value });
  }

  if (fields.length === 0 && type !== "loop") return null;

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-400">Campos desta etapa — só o necessário para o que você escolheu acima.</p>
      {fields.map((field) => {
        const required = isFieldRequired(type, field, params, integrationHints);
        const value = String(params[field.key] ?? "");
        const empty = !value.trim();
        return (
          <div key={field.key} id={`action-${actionIndex}-field-${field.key}`} className="scroll-mt-28">
            <FieldInput
              field={field}
              value={value}
              required={required}
              showWarning={required && empty}
              onChange={(v) => setField(field.key, v)}
            />
          </div>
        );
      })}
      {type === "loop" && (
        <div className="mt-2 border-l-2 border-brand-200 pl-3 py-2 bg-slate-50 rounded-r">
          <p className="text-xs font-semibold text-slate-700 mb-2">Ações internas do loop</p>
          <p className="text-[10px] text-slate-500 italic mb-1">
            Dica: No momento, use o Assistente de IA para montar loops complexos ou edite o JSON manualmente.
          </p>
          {Array.isArray(params.actions) && params.actions.length > 0 ? (
            <ul className="space-y-1">
              {params.actions.map((a: any, i: number) => (
                <li key={i} className="text-xs text-slate-600 flex items-center gap-2">
                  <span className="font-mono text-[10px] bg-slate-200 px-1 rounded">{i+1}</span>
                  {a.label || a.type}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-slate-400">Nenhuma ação interna</p>
          )}
        </div>
      )}
    </div>
  );
}

function FieldInput({
  field,
  value,
  required,
  showWarning,
  onChange,
}: {
  field: { key: string; label: string; type: string; placeholder?: string; hint?: string; options?: { value: string; label: string }[] };
  value: string;
  required: boolean;
  showWarning: boolean;
  onChange: (value: string) => void;
}) {
  const label = (
    <label className="mb-1 flex items-center gap-2 text-xs font-medium text-slate-700">
      <span>{field.label}</span>
      {required ? (
        <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
          Obrigatório
        </span>
      ) : (
        <span className="text-slate-400">(opcional)</span>
      )}
    </label>
  );

  const inputClass = `input text-sm ${showWarning ? "border-amber-400 ring-1 ring-amber-100" : ""}`;

  if (field.type === "select" && field.options) {
    return (
      <div>
        {label}
        <select className={inputClass} value={value} onChange={(e) => onChange(e.target.value)}>
          {field.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {field.hint && <p className="mt-1 text-xs text-slate-400">{field.hint}</p>}
      </div>
    );
  }

  if (field.type === "textarea") {
    return (
      <div>
        {label}
        <textarea className={`${inputClass} min-h-[80px]`} placeholder={field.placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
        {showWarning && <p className="mt-1 text-xs text-amber-700">Este campo é necessário para esta etapa funcionar.</p>}
        {field.hint && <p className="mt-1 text-xs text-slate-400">{field.hint}</p>}
      </div>
    );
  }

  return (
    <div>
      {label}
      <input
        type={field.type === "email" ? "email" : field.type === "url" ? "url" : "text"}
        className={inputClass}
        placeholder={field.placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {showWarning && <p className="mt-1 text-xs text-amber-700">Este campo é necessário para esta etapa funcionar.</p>}
      {field.hint && <p className="mt-1 text-xs text-slate-400">{field.hint}</p>}
    </div>
  );
}
