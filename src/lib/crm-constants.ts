export const LEAD_STATUSES = [
  { value: "new", label: "Novo" },
  { value: "contacted", label: "Contatado" },
  { value: "qualified", label: "Qualificado" },
  { value: "won", label: "Ganho" },
  { value: "lost", label: "Perdido" },
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number]["value"];

export const EVENT_TYPE_LABEL: Record<string, string> = {
  created: "Criado",
  updated: "Atualizado",
  email_sent: "E-mail enviado",
  sms_sent: "SMS enviado",
  whatsapp_sent: "WhatsApp enviado",
  note: "Nota",
  status_change: "Status alterado",
  automation: "Automação",
};
