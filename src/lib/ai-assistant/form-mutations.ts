import "server-only";
import { prisma } from "../db";
import {
  FormConfig,
  FormFieldDef,
  FormFieldType,
  getFormConfig,
  uniqueFieldKey,
} from "../form-config";
import { prepareFormHtmlForSave, validateFormHtml } from "../form-template";
import { Flow, Trigger } from "../flow-types";

export async function loadFlowForAutomation(userId: string, automationId: string) {
  const a = await prisma.automation.findFirst({ where: { id: automationId, userId } });
  if (!a) return null;
  const flow: Flow = {
    name: a.name,
    description: a.description,
    category: a.category,
    trigger: JSON.parse(a.triggerJson),
    actions: JSON.parse(a.actionsJson),
  };
  return { automation: a, flow };
}

export async function saveFormConfig(userId: string, automationId: string, config: FormConfig) {
  if (config.customHtml?.trim()) {
    const customHtml = prepareFormHtmlForSave(config.customHtml);
    config = { ...config, customHtml };
    const v = validateFormHtml(customHtml, config.fields);
    if (!v.ok) throw new Error(v.error);
  }
  const loaded = await loadFlowForAutomation(userId, automationId);
  if (!loaded) throw new Error("Automação não encontrada");
  const trigger: Trigger = loaded.flow.trigger;
  trigger.config = { ...(trigger.config ?? {}), form: config };
  await prisma.automation.update({
    where: { id: automationId },
    data: { triggerJson: JSON.stringify(trigger) },
  });
  return config;
}

export async function mutateForm(
  userId: string,
  automationId: string,
  mutator: (config: FormConfig) => FormConfig
) {
  const loaded = await loadFlowForAutomation(userId, automationId);
  if (!loaded) throw new Error("Automação não encontrada");
  const config = mutator(getFormConfig(loaded.flow));
  return saveFormConfig(userId, automationId, config);
}

export function parseFieldType(v: unknown): FormFieldType {
  const t = String(v ?? "text");
  return ["text", "email", "tel", "textarea", "number", "select"].includes(t) ? (t as FormFieldType) : "text";
}

export function buildNewField(label: string, existing: FormFieldDef[], overrides?: Partial<FormFieldDef>): FormFieldDef {
  const id = overrides?.id ?? uniqueFieldKey(label, existing.map((f) => f.id));
  return {
    id,
    label,
    type: overrides?.type ?? "text",
    required: overrides?.required ?? false,
    placeholder: overrides?.placeholder,
    options: overrides?.options,
  };
}
