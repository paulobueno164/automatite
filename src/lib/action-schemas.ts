import { ActionType } from "./flow-types";

export type ActionFieldType = "text" | "textarea" | "select" | "email" | "url";

export type ActionFieldDef = {
  key: string;
  label: string;
  type: ActionFieldType;
  placeholder?: string;
  hint?: string;
  optional?: boolean;
  options?: { value: string; label: string }[];
};

export type ActionSchema = {
  fields: ActionFieldDef[];
  /** Retorna o provider necessário com base nos params da ação, ou null se não precisa de integração. */
  resolveProvider?: (params: Record<string, unknown>) => string | null;
};

const TASK_APP_OPTIONS = [
  { value: "automatite", label: "Automatite (sem configurar nada)" },
  { value: "pipedrive", label: "Pipedrive (avançado)" },
  { value: "trello", label: "Trello (avançado)" },
  { value: "asana", label: "Asana (avançado)" },
];

const SHEET_APP_OPTIONS = [
  { value: "automatite", label: "Automatite — Registros (sem configurar nada)" },
  { value: "google_sheets", label: "Google Sheets (avançado)" },
];

const HTTP_METHODS = [
  { value: "POST", label: "POST" },
  { value: "GET", label: "GET" },
  { value: "PUT", label: "PUT" },
  { value: "PATCH", label: "PATCH" },
  { value: "DELETE", label: "DELETE" },
];

/** Campos de configuração por tipo de ação — usados no editor e no preview. */
export const ACTION_SCHEMAS: Record<ActionType, ActionSchema> = {
  send_email: {
    fields: [
      { key: "to", label: "Destinatário", type: "text", placeholder: "{email}", hint: "E-mail ou placeholder do gatilho, ex: {email}" },
      { key: "subject", label: "Assunto", type: "text", placeholder: "Bem-vindo!" },
      {
        key: "body",
        label: "Mensagem",
        type: "textarea",
        placeholder: "Olá {nome},\n\nObrigado pelo interesse!",
        hint: "Texto que aparece no meio do layout configurado em Configurações → Seu e-mail.",
      },
      { key: "from", label: "Remetente", type: "email", placeholder: "voce@empresa.com", optional: true, hint: "Opcional — usa o e-mail que você configurou em Configurações." },
    ],
    resolveProvider: () => "smtp",
  },
  send_sms: {
    fields: [
      { key: "to", label: "Telefone", type: "text", placeholder: "{telefone}", hint: "Com DDI, ex: +5511999999999" },
      { key: "text", label: "Mensagem", type: "textarea", placeholder: "Seu agendamento foi confirmado." },
    ],
    resolveProvider: () => "twilio", // coberto pela plataforma quando configurado
  },
  send_whatsapp: {
    fields: [
      { key: "to", label: "Telefone", type: "text", placeholder: "{telefone}", hint: "Número com DDI, sem + ou espaços" },
      { key: "text", label: "Mensagem", type: "textarea", placeholder: "Olá {nome}, recebemos sua mensagem!" },
    ],
    resolveProvider: () => "whatsapp",
  },
  upsert_lead: {
    fields: [
      { key: "name", label: "Nome", type: "text", placeholder: "{nome}" },
      { key: "email", label: "E-mail", type: "text", placeholder: "{email}", optional: true, hint: "Recomendado — evita duplicar contatos" },
      { key: "phone", label: "Telefone", type: "text", placeholder: "{telefone}", optional: true },
      { key: "company", label: "Empresa", type: "text", placeholder: "{empresa}", optional: true },
      {
        key: "status",
        label: "Status",
        type: "select",
        options: [
          { value: "new", label: "Novo" },
          { value: "contacted", label: "Contatado" },
          { value: "qualified", label: "Qualificado" },
          { value: "won", label: "Ganho" },
          { value: "lost", label: "Perdido" },
        ],
      },
      { key: "note", label: "Nota", type: "textarea", optional: true, placeholder: "Lead recebido pelo formulário" },
    ],
  },
  create_task: {
    fields: [
      { key: "app", label: "Onde criar", type: "select", options: TASK_APP_OPTIONS },
      { key: "title", label: "Título da tarefa", type: "text", placeholder: "Novo lead: {nome}" },
      { key: "listId", label: "ID da lista (Trello)", type: "text", optional: true, hint: "Obrigatório para Trello se não configurou padrão em Integrações." },
      { key: "projectId", label: "ID do projeto (Asana)", type: "text", optional: true, hint: "Obrigatório para Asana se não configurou padrão em Integrações." },
    ],
    resolveProvider: (params) => {
      const app = String(params.app ?? "automatite").toLowerCase();
      if (app === "automatite" || app === "interno" || app === "tarefas") return null;
      if (app.includes("pipedrive")) return "pipedrive";
      if (app.includes("trello")) return "trello";
      if (app.includes("asana")) return "asana";
      return null;
    },
  },
  append_sheet: {
    fields: [
      { key: "app", label: "Onde salvar", type: "select", options: SHEET_APP_OPTIONS },
      { key: "sheet", label: "Nome da lista", type: "text", placeholder: "Leads", hint: "Ex: Leads, Agendamentos, Respostas" },
      { key: "spreadsheetId", label: "ID da planilha Google", type: "text", optional: true, hint: "Só para Google Sheets." },
    ],
    resolveProvider: (params) => {
      const app = String(params.app ?? "automatite").toLowerCase();
      if (app === "automatite" || app === "registros" || app === "interno") return null;
      return "google_sheets";
    },
  },
  http_request: {
    fields: [
      { key: "url", label: "URL", type: "url", placeholder: "https://api.exemplo.com/webhook" },
      { key: "method", label: "Método", type: "select", options: HTTP_METHODS },
      { key: "body", label: "Corpo (JSON)", type: "textarea", optional: true, hint: "Opcional — se vazio, envia o payload do gatilho." },
    ],
  },
  ai_generate: {
    fields: [
      { key: "prompt", label: "Instrução para a IA", type: "textarea", placeholder: "Escreva um e-mail curto para o lead {nome} da empresa {empresa}." },
    ],
    resolveProvider: () => "anthropic",
  },
  analyze_image: {
    fields: [
      { key: "image_url", label: "URL da imagem", type: "url", placeholder: "{url_da_imagem}", hint: "URL pública da imagem ou placeholder do gatilho." },
      { key: "prompt", label: "O que extrair?", type: "textarea", placeholder: "Extraia o valor total e a data deste recibo.", hint: "Instrução para a IA sobre o que procurar na imagem." },
    ],
    resolveProvider: () => "anthropic",
  },
  condition: {
    fields: [
      { key: "prompt", label: "Pergunta para a IA", type: "textarea", placeholder: "O cliente parece interessado em comprar agora?", hint: "A IA responderá SIM ou NÃO para decidir o caminho." },
    ],
    resolveProvider: () => "anthropic",
  },
  delay: {
    fields: [
      { key: "seconds", label: "Segundos", type: "text", placeholder: "10", hint: "Máximo 60 segundos." },
    ],
  },
  send_slack: {
    fields: [
      { key: "channel", label: "Canal", type: "text", placeholder: "#geral", hint: "Nome do canal (ex: #vendas) ou ID." },
      { key: "text", label: "Mensagem", type: "textarea", placeholder: "Novo lead: {nome}" },
    ],
    resolveProvider: () => "slack",
  },
  send_discord: {
    fields: [
      { key: "text", label: "Mensagem", type: "textarea", placeholder: "Novo lead: {nome}" },
      { key: "webhookUrl", label: "Webhook URL (opcional)", type: "url", optional: true, hint: "Opcional — se vazio, usa o configurado em Integrações." },
    ],
    resolveProvider: () => "discord",
  },
  transform: {
    fields: [
      { key: "instruction", label: "Instrução de transformação", type: "textarea", placeholder: "Extraia apenas o primeiro nome em letras maiúsculas", hint: "O resultado ficará disponível na variável {transformed_output}." },
    ],
    resolveProvider: () => "anthropic",
  },
  wait_for_approval: {
    fields: [
      { key: "to", label: "Avisar por e-mail", type: "text", placeholder: "voce@empresa.com", hint: "E-mail que receberá o link para aprovação." },
      { key: "subject", label: "Assunto do e-mail", type: "text", placeholder: "Aprovação necessária: {nome}" },
    ],
  },
  loop: {
    fields: [
      { key: "items", label: "Lista de itens", type: "textarea", placeholder: "{minha_lista}", hint: "Variável com a lista de itens para repetir (ex: {itens})." },
    ],
  },
  log: {
    fields: [{ key: "message", label: "Mensagem", type: "text", placeholder: "Registro de debug" }],
  },
};

/** Valores padrão ao criar ou trocar o tipo de uma ação. */
export const ACTION_DEFAULTS: Record<ActionType, Record<string, unknown>> = {
  send_email: { to: "{email}", subject: "", body: "" },
  send_sms: { to: "{telefone}", text: "" },
  send_whatsapp: { to: "{telefone}", text: "" },
  upsert_lead: { name: "{nome}", email: "{email}", status: "new" },
  create_task: { app: "automatite", title: "" },
  append_sheet: { app: "automatite", sheet: "Dados" },
  http_request: { url: "", method: "POST" },
  ai_generate: { prompt: "" },
  analyze_image: { image_url: "", prompt: "" },
  condition: { prompt: "" },
  delay: { seconds: "5" },
  send_slack: { channel: "", text: "" },
  send_discord: { text: "" },
  transform: { instruction: "" },
  wait_for_approval: { to: "{user_email}", subject: "Aprovação pendente" },
  loop: { items: "", actions: [] },
  log: { message: "" },
};

export function getActionSchema(type: ActionType): ActionSchema {
  return ACTION_SCHEMAS[type];
}

export type IntegrationHints = {
  trelloHasDefaultList?: boolean;
  asanaHasDefaultProject?: boolean;
  sheetsHasDefaultSpreadsheet?: boolean;
};

/** Campos visíveis conforme o que a ação realmente usa (ex: esconde ID do Trello se app=automatite). */
export function getVisibleFields(type: ActionType, params: Record<string, unknown>): ActionFieldDef[] {
  const schema = ACTION_SCHEMAS[type];
  const app = String(params.app ?? "").toLowerCase();

  return schema.fields.filter((field) => {
    if (type === "create_task") {
      if (field.key === "listId") return app.includes("trello");
      if (field.key === "projectId") return app.includes("asana");
    }
    if (type === "append_sheet") {
      if (field.key === "spreadsheetId") return app.includes("google");
    }
    return true;
  });
}

/** Se um campo é obrigatório para esta ação específica (não para o tipo inteiro). */
export function isFieldRequired(
  type: ActionType,
  field: ActionFieldDef,
  params: Record<string, unknown>,
  hints: IntegrationHints = {}
): boolean {
  if (field.optional) return false;
  if (!getVisibleFields(type, params).some((f) => f.key === field.key)) return false;

  if (type === "create_task") {
    const app = String(params.app ?? "automatite").toLowerCase();
    if (field.key === "listId") return app.includes("trello") && !hints.trelloHasDefaultList;
    if (field.key === "projectId") return app.includes("asana") && !hints.asanaHasDefaultProject;
  }
  if (type === "append_sheet" && field.key === "spreadsheetId") {
    const app = String(params.app ?? "automatite").toLowerCase();
    return app.includes("google") && !hints.sheetsHasDefaultSpreadsheet;
  }

  return true;
}

/** Lista campos obrigatórios ainda vazios para uma ação. */
export function getMissingFields(
  type: ActionType,
  params: Record<string, unknown>,
  hints: IntegrationHints = {}
): ActionFieldDef[] {
  return getVisibleFields(type, params).filter((field) => {
    if (!isFieldRequired(type, field, params, hints)) return false;
    const value = params[field.key];
    return value === undefined || value === null || String(value).trim() === "";
  });
}

/** Retorna o valor formatado de um campo para exibição no preview. */
export function formatFieldValue(field: ActionFieldDef, value: unknown): string {
  if (value === undefined || value === null || value === "") return "—";
  if (field.type === "select" && field.options) {
    const opt = field.options.find((o) => o.value === value);
    return opt?.label ?? String(value);
  }
  const str = String(value);
  return str.length > 120 ? `${str.slice(0, 120)}…` : str;
}
