import { Action, ActionType, Flow, ACTION_CATALOG } from "./flow-types";
import { ACTION_SCHEMAS, getMissingFields, IntegrationHints } from "./action-schemas";
import { getProvider } from "./provider-catalog";
import { buildActionFixUrl, buildSettingsFixUrl } from "./fix-urls";

export type ReadinessItemKind = "field" | "integration" | "platform";

export type ReadinessItem = {
  kind: ReadinessItemKind;
  actionIndex: number;
  actionLabel: string;
  actionType: ActionType;
  requirement: string;
  fieldKey?: string;
  providerId?: string;
  detail?: string;
  status: "ok" | "missing";
  fixUrl?: string;
  fixLabel?: string;
};

export type ActionReadinessGroup = {
  index: number;
  label: string;
  actionType: ActionType;
  items: ReadinessItem[];
  complete: boolean;
};

export type ReadinessResult = {
  ready: boolean;
  items: ReadinessItem[];
  groups: ActionReadinessGroup[];
  missingCount: number;
};

export type ReadinessContext = {
  connectedProviders: string[];
  hasPlatformResend: boolean;
  hasPlatformSms: boolean;
  hasUserAnthropicKey: boolean;
  hasPlatformAnthropicKey: boolean;
  integrationHints: IntegrationHints;
};

function isProviderConnected(providerId: string, ctx: ReadinessContext): boolean {
  if (providerId === "smtp") return ctx.connectedProviders.includes("smtp") || ctx.hasPlatformResend;
  if (providerId === "resend") return ctx.connectedProviders.includes("resend") || ctx.hasPlatformResend;
  if (providerId === "twilio") return ctx.connectedProviders.includes("twilio") || ctx.hasPlatformSms;
  if (providerId === "anthropic") return ctx.hasUserAnthropicKey || ctx.hasPlatformAnthropicKey;
  return ctx.connectedProviders.includes(providerId);
}

function providerLabel(providerId: string): string {
  if (providerId === "anthropic") return "Inteligência artificial";
  if (providerId === "smtp" || providerId === "resend") return "Seu e-mail (SMTP)";
  if (providerId === "twilio") return "SMS";
  return getProvider(providerId)?.name ?? providerId;
}

function isPlatformOwned(providerId: string): boolean {
  return providerId === "twilio" || providerId === "anthropic";
}

function checkAction(action: Action, index: number, ctx: ReadinessContext, automationId?: string): ReadinessItem[] {
  const items: ReadinessItem[] = [];
  const params = action.params ?? {};
  const label = action.label || ACTION_CATALOG[action.type]?.title || action.type;

  for (const field of getMissingFields(action.type, params, ctx.integrationHints)) {
    items.push({
      kind: "field",
      actionIndex: index,
      actionLabel: label,
      actionType: action.type,
      requirement: field.label,
      fieldKey: field.key,
      detail: `Passo ${index + 1} — preencha este campo`,
      status: "missing",
      fixUrl: automationId ? buildActionFixUrl(automationId, index, field.key) : undefined,
      fixLabel: "Preencher campo",
    });
  }

  const providerId = ACTION_SCHEMAS[action.type].resolveProvider?.(params);
  if (providerId && !isProviderConnected(providerId, ctx)) {
    const platform = isPlatformOwned(providerId);
    const isEmail = providerId === "smtp" || providerId === "resend";
    items.push({
      kind: platform ? "platform" : "integration",
      actionIndex: index,
      actionLabel: label,
      actionType: action.type,
      requirement: providerLabel(providerId),
      providerId,
      detail: isEmail
        ? `Passo ${index + 1} — configure seu e-mail com o tutorial`
        : platform
          ? `Passo ${index + 1} — recurso da plataforma ainda não disponível`
          : `Passo ${index + 1} — conecte ${providerLabel(providerId)}`,
      status: "missing",
      fixUrl: buildSettingsFixUrl(providerId),
      fixLabel: isEmail ? "Configurar e-mail" : providerId === "anthropic" ? "Configurar IA" : `Conectar ${providerLabel(providerId)}`,
    });
  }

  return items;
}

/** Verifica o que falta para esta automação rodar — só o que cada passo realmente usa. */
export function getAutomationReadiness(flow: Flow, ctx: ReadinessContext, automationId?: string): ReadinessResult {
  const items: ReadinessItem[] = [];
  const groups: ActionReadinessGroup[] = [];

  for (let i = 0; i < flow.actions.length; i++) {
    const action = flow.actions[i];
    const actionItems = checkAction(action, i, ctx, automationId);
    items.push(...actionItems);
    groups.push({
      index: i,
      label: action.label || ACTION_CATALOG[action.type]?.title || action.type,
      actionType: action.type,
      items: actionItems,
      complete: actionItems.length === 0,
    });
  }

  const missing = items.filter((i) => i.status === "missing");
  return {
    ready: missing.length === 0,
    items,
    groups: groups.filter((g) => !g.complete),
    missingCount: missing.length,
  };
}
