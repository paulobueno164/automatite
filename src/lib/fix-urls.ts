/** Monta URL direta para o item que falta resolver. */
export function buildActionFixUrl(automationId: string, actionIndex: number, fieldKey?: string): string {
  const base = `/automations/${automationId}/edit`;
  if (fieldKey) return `${base}#action-${actionIndex}-field-${fieldKey}`;
  return `${base}#action-${actionIndex}`;
}

export function buildSettingsFixUrl(providerId: string): string {
  if (providerId === "smtp" || providerId === "resend") return "/settings#setting-email";
  if (providerId === "anthropic") return "/settings#setting-anthropic";
  return `/settings#integration-${providerId}`;
}
