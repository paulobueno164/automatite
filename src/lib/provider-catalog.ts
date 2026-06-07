// Catálogo de integrações — DADOS PUROS, sem dependências de servidor.
// Pode ser importado tanto por componentes client quanto por código de servidor.

export type ProviderId =
  | "smtp"
  | "resend"
  | "google_sheets"
  | "whatsapp"
  | "pipedrive"
  | "twilio"
  | "trello"
  | "asana";

export type ProviderField = {
  key: string;
  label: string;
  type: "text" | "password" | "textarea";
  placeholder?: string;
  hint?: string;
  optional?: boolean;
};

export type ProviderDef = {
  id: ProviderId;
  name: string;
  emoji: string;
  // Quais ações esse provider atende
  handles: string[];
  fields: ProviderField[];
  docs?: string;
};

export type Credentials = Record<string, string>;

/** Catálogo de integrações disponíveis e os campos de credencial de cada uma. */
export const PROVIDERS: ProviderDef[] = [
  {
    id: "smtp",
    name: "Seu e-mail (SMTP)",
    emoji: "✉️",
    handles: ["send_email"],
    fields: [
      { key: "preset", label: "Provedor", type: "text", optional: true },
      { key: "host", label: "Servidor SMTP", type: "text", placeholder: "smtp.gmail.com" },
      { key: "port", label: "Porta", type: "text", placeholder: "587" },
      { key: "secure", label: "SSL", type: "text", placeholder: "false" },
      { key: "user", label: "E-mail", type: "text", placeholder: "voce@gmail.com" },
      { key: "password", label: "Senha", type: "password" },
      { key: "fromEmail", label: "Remetente", type: "text", placeholder: "voce@gmail.com" },
      { key: "fromName", label: "Nome do remetente", type: "text", optional: true, placeholder: "Sua Empresa" },
      { key: "templateHtml", label: "Layout HTML", type: "textarea", optional: true },
      { key: "templateFooter", label: "Rodapé do e-mail", type: "text", optional: true },
      { key: "templateAccentColor", label: "Cor do cabeçalho", type: "text", optional: true },
    ],
  },
  {
    id: "google_sheets",
    name: "Google Sheets",
    emoji: "📊",
    handles: ["append_sheet"],
    docs: "https://developers.google.com/sheets/api",
    fields: [
      {
        key: "serviceAccountJson",
        label: "Service Account JSON",
        type: "textarea",
        placeholder: '{ "client_email": "...", "private_key": "..." }',
        hint: "Crie uma conta de serviço no Google Cloud, baixe o JSON e compartilhe a planilha com o e-mail dela.",
      },
      { key: "spreadsheetId", label: "ID da planilha (padrão)", type: "text", optional: true, hint: "Opcional — pode vir da ação." },
    ],
  },
  {
    id: "whatsapp",
    name: "WhatsApp (Cloud API)",
    emoji: "💬",
    handles: ["send_whatsapp"],
    docs: "https://developers.facebook.com/docs/whatsapp/cloud-api",
    fields: [
      { key: "accessToken", label: "Access Token", type: "password" },
      { key: "phoneNumberId", label: "Phone Number ID", type: "text" },
    ],
  },
  {
    id: "pipedrive",
    name: "Pipedrive",
    emoji: "🟢",
    handles: ["create_task"],
    docs: "https://developers.pipedrive.com/docs/api/v1",
    fields: [{ key: "apiToken", label: "API Token", type: "password" }],
  },
  {
    id: "twilio",
    name: "Twilio (SMS)",
    emoji: "📱",
    handles: ["send_sms"],
    docs: "https://www.twilio.com/docs/sms",
    fields: [
      { key: "accountSid", label: "Account SID", type: "text" },
      { key: "authToken", label: "Auth Token", type: "password" },
      { key: "fromNumber", label: "Número remetente", type: "text", placeholder: "+5511999999999" },
    ],
  },
  {
    id: "trello",
    name: "Trello",
    emoji: "📋",
    handles: ["create_task"],
    docs: "https://developer.atlassian.com/cloud/trello/rest/",
    fields: [
      { key: "key", label: "API Key", type: "password" },
      { key: "token", label: "Token", type: "password" },
      { key: "defaultListId", label: "ID da lista (padrão)", type: "text", optional: true },
    ],
  },
  {
    id: "asana",
    name: "Asana",
    emoji: "🦄",
    handles: ["create_task"],
    docs: "https://developers.asana.com/reference/rest-api-reference",
    fields: [
      { key: "accessToken", label: "Personal Access Token", type: "password" },
      { key: "defaultProjectId", label: "ID do projeto (padrão)", type: "text", optional: true },
    ],
  },
];

export function getProvider(id: string): ProviderDef | undefined {
  return PROVIDERS.find((p) => p.id === id);
}
