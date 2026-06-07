import { Flow } from "./flow-types";
import { extractPlaceholdersFromFlow } from "./form-fields";

export type FormFieldType = "text" | "email" | "tel" | "textarea" | "number" | "select";

export type FormFieldDef = {
  id: string;
  label: string;
  type: FormFieldType;
  required: boolean;
  placeholder?: string;
  options?: string[];
};

export type FormStyle = {
  backgroundColor: string;
  backgroundImageUrl?: string;
  accentColor: string;
  buttonLabel: string;
  cardBackground: string;
};

export type FormSuccess = {
  title: string;
  message: string;
  showAnotherButton: boolean;
  anotherButtonLabel: string;
};

export type FormConfig = {
  title: string;
  description: string;
  fields: FormFieldDef[];
  style: FormStyle;
  success: FormSuccess;
  /** HTML personalizado. Deve incluir {campos} ou cada {campo:id}. */
  customHtml?: string;
};

export const DEFAULT_FORM_STYLE: FormStyle = {
  backgroundColor: "#f1f5f9",
  accentColor: "#6366f1",
  buttonLabel: "Enviar",
  cardBackground: "#ffffff",
};

export const DEFAULT_FORM_SUCCESS: FormSuccess = {
  title: "Enviado com sucesso!",
  message: "Recebemos suas informações. Em breve entraremos em contato.",
  showAnotherButton: true,
  anotherButtonLabel: "Enviar outra resposta",
};

const FIELD_META: Record<string, Partial<FormFieldDef>> = {
  nome: { label: "Nome", type: "text", required: true, placeholder: "Maria Silva" },
  email: { label: "E-mail", type: "email", required: true, placeholder: "maria@exemplo.com" },
  telefone: { label: "Telefone", type: "tel", required: false, placeholder: "(11) 99999-9999" },
  empresa: { label: "Empresa", type: "text", required: false, placeholder: "Minha Empresa Ltda" },
  mensagem: { label: "Mensagem", type: "textarea", required: false, placeholder: "Como podemos ajudar?" },
  data: { label: "Data", type: "text", required: false, placeholder: "15/06/2026" },
  pedido: { label: "Número do pedido", type: "text", required: false },
};

const FIELD_ORDER = ["nome", "email", "telefone", "empresa", "data", "pedido", "mensagem"];

export function slugifyFieldKey(label: string): string {
  const base = label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 32);
  return base || "campo";
}

export function uniqueFieldKey(label: string, existing: string[]): string {
  let key = slugifyFieldKey(label);
  let n = 2;
  while (existing.includes(key)) {
    key = `${slugifyFieldKey(label)}_${n}`;
    n++;
  }
  return key;
}

function sortKeys(keys: string[]): string[] {
  return [...keys].sort((a, b) => {
    const ia = FIELD_ORDER.indexOf(a);
    const ib = FIELD_ORDER.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
}

/** Gera config padrão a partir dos placeholders do fluxo. */
export function buildDefaultFormConfig(flow: Flow): FormConfig {
  const keys = sortKeys(extractPlaceholdersFromFlow(flow));
  const fieldKeys = keys.length > 0 ? keys : ["nome", "email"];

  const fields: FormFieldDef[] = fieldKeys.map((key) => ({
    id: key,
    label: FIELD_META[key]?.label ?? key.charAt(0).toUpperCase() + key.slice(1),
    type: FIELD_META[key]?.type ?? "text",
    required: FIELD_META[key]?.required ?? (key === "nome" || key === "email"),
    placeholder: FIELD_META[key]?.placeholder,
  }));

  return {
    title: flow.name,
    description: flow.description ?? "",
    fields,
    style: { ...DEFAULT_FORM_STYLE },
    success: { ...DEFAULT_FORM_SUCCESS },
  };
}

function normalizeField(raw: Record<string, unknown>): FormFieldDef | null {
  const id = String(raw.id ?? raw.key ?? "").trim();
  const label = String(raw.label ?? "").trim();
  if (!id || !label) return null;
  const type = (String(raw.type ?? "text") as FormFieldType) || "text";
  return {
    id,
    label,
    type: ["text", "email", "tel", "textarea", "number", "select"].includes(type) ? type : "text",
    required: Boolean(raw.required),
    placeholder: raw.placeholder ? String(raw.placeholder) : undefined,
    options: Array.isArray(raw.options) ? raw.options.map(String) : undefined,
  };
}

/** Lê a config do formulário salva no gatilho. */
export function getFormConfig(flow: Flow): FormConfig {
  const stored = flow.trigger.config?.form as Partial<FormConfig> | undefined;
  const defaults = buildDefaultFormConfig(flow);

  if (!stored) return defaults;

  const fields = Array.isArray(stored.fields)
    ? stored.fields.map((f) => normalizeField(f as Record<string, unknown>)).filter(Boolean)
    : defaults.fields;

  return {
    title: stored.title?.trim() || defaults.title,
    description: stored.description?.trim() ?? defaults.description,
    fields: fields.length > 0 ? (fields as FormFieldDef[]) : defaults.fields,
    style: { ...DEFAULT_FORM_STYLE, ...(stored.style ?? {}) },
    success: { ...DEFAULT_FORM_SUCCESS, ...(stored.success ?? {}) },
    customHtml: typeof stored.customHtml === "string" ? stored.customHtml : undefined,
  };
}

/** Payload do formulário → chaves usadas nos placeholders {campo}. */
export function formValuesToPayload(values: Record<string, string>, fields: FormFieldDef[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const field of fields) {
    out[field.id] = values[field.id] ?? "";
  }
  return out;
}

/** Substitui {campo} em textos da tela de sucesso. */
export function interpolateFormText(text: string, values: Record<string, string>): string {
  return text.replace(/\{([\w]+)\}/g, (_, key) => values[key] ?? "");
}
