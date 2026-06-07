import { Flow } from "./flow-types";
import { FormFieldDef, getFormConfig } from "./form-config";

export type { FormFieldDef } from "./form-config";
export { getFormConfig, buildDefaultFormConfig, type FormConfig } from "./form-config";

const SKIP_KEYS = new Set(["ai_output"]);

/** Extrai placeholders {campo} usados no fluxo. */
export function extractPlaceholdersFromFlow(flow: Flow): string[] {
  const raw = JSON.stringify({ actions: flow.actions, trigger: flow.trigger });
  const keys = new Set<string>();
  for (const m of raw.matchAll(/\{([\w]+)\}/g)) {
    const key = m[1];
    if (!SKIP_KEYS.has(key)) keys.add(key);
  }
  return Array.from(keys);
}

/** Campos do formulário público. */
export function buildFormFields(flow: Flow): FormFieldDef[] {
  return getFormConfig(flow).fields;
}
