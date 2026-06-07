"use client";

import { FormFieldDef } from "@/lib/form-config";

export function FormFieldInput({
  field,
  value,
  onChange,
  accent,
  bare = false,
}: {
  field: FormFieldDef;
  value: string;
  onChange: (v: string) => void;
  accent: string;
  bare?: boolean;
}) {
  const focusStyle = { borderColor: accent, boxShadow: `0 0 0 2px ${accent}22` };
  const wrapClass = bare ? "" : "mb-0";

  const label = (
    <label htmlFor={`atk-field-${field.id}`} className="mb-1 block text-sm font-medium text-slate-700">
      {field.label}
      {field.required && <span className="text-red-500"> *</span>}
    </label>
  );

  if (field.type === "textarea") {
    return (
      <div className={wrapClass} data-atk-field={field.id}>
        {label}
        <textarea
          id={`atk-field-${field.id}`}
          name={field.id}
          className="input min-h-[100px] w-full text-sm"
          placeholder={field.placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={(e) => Object.assign(e.target.style, focusStyle)}
          onBlur={(e) => {
            e.target.style.borderColor = "";
            e.target.style.boxShadow = "";
          }}
        />
      </div>
    );
  }

  if (field.type === "select" && field.options?.length) {
    return (
      <div className={wrapClass} data-atk-field={field.id}>
        {label}
        <select
          id={`atk-field-${field.id}`}
          name={field.id}
          className="input w-full text-sm"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">Selecione…</option>
          {field.options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>
    );
  }

  const inputType =
    field.type === "number" ? "number" : field.type === "email" ? "email" : field.type === "tel" ? "tel" : "text";

  return (
    <div className={wrapClass} data-atk-field={field.id}>
      {label}
      <input
        id={`atk-field-${field.id}`}
        name={field.id}
        type={inputType}
        className="input w-full text-sm"
        placeholder={field.placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={(e) => Object.assign(e.target.style, focusStyle)}
        onBlur={(e) => {
          e.target.style.borderColor = "";
          e.target.style.boxShadow = "";
        }}
      />
    </div>
  );
}
