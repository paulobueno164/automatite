// Serviços inclusos na plataforma — zero configuração para o usuário final.

export type PlatformService = {
  id: string;
  name: string;
  emoji: string;
  description: string;
  /** Ações do fluxo que esse serviço cobre nativamente. */
  handles: string[];
};

export const PLATFORM_SERVICES: PlatformService[] = [
  {
    id: "records",
    name: "Registros",
    emoji: "📋",
    description: "Salva leads e respostas de formulário aqui no Automatite, sem planilha.",
    handles: ["append_sheet"],
  },
  {
    id: "crm",
    name: "CRM de leads",
    emoji: "👥",
    description: "Contatos com histórico completo — sem Pipedrive ou planilha.",
    handles: ["upsert_lead"],
  },
  {
    id: "tasks",
    name: "Tarefas",
    emoji: "✅",
    description: "Lembretes e follow-ups internos.",
    handles: ["create_task"],
  },
  {
    id: "ai",
    name: "Inteligência artificial",
    emoji: "🤖",
    description: "Gera textos personalizados com IA — já incluso na sua conta.",
    handles: ["ai_generate"],
  },
];

/** Providers externos — opcionais, para quem já usa essas ferramentas. */
export const EXTERNAL_PROVIDER_IDS = [
  "google_sheets",
  "whatsapp",
  "pipedrive",
  "twilio",
  "trello",
  "asana",
  "slack",
] as const;

export function isPlatformEmailReady(): boolean {
  return !!process.env.RESEND_API_KEY;
}

export function isPlatformSmsReady(): boolean {
  return !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER);
}
