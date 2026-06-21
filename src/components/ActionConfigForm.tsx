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

  if (fields.length === 0) return null;

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
              id={`input-${actionIndex}-${field.key}`}
              field={field}
              value={value}
              required={required}
              showWarning={required && empty}
              onChange={(v) => setField(field.key, v)}
            />
          </div>
        );
      })}
    </div>
  );
}

function FieldInput({
  id,
  field,
  value,
  required,
  showWarning,
  onChange,
}: {
  id: string;
  field: { key: string; label: string; type: string; placeholder?: string; hint?: string; options?: { value: string; label: string }[] };
  value: string;
  required: boolean;
  showWarning: boolean;
  onChange: (value: string) => void;
}) {
  const label = (
    <label htmlFor={id} className="mb-1 flex items-center gap-2 text-xs font-medium text-slate-700">
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
        <select id={id} className={inputClass} value={value} onChange={(e) => onChange(e.target.value)}>
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
        <textarea id={id} className={`${inputClass} min-h-[80px]`} placeholder={field.placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
        {showWarning && <p className="mt-1 text-xs text-amber-700">Este campo é necessário para esta etapa funcionar.</p>}
        {field.hint && <p className="mt-1 text-xs text-slate-400">{field.hint}</p>}
      </div>
    );
  }

  return (
    <div>
      {label}
      <input
        id={id}
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
