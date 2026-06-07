import Anthropic from "@anthropic-ai/sdk";
import { ACTION_CATALOG, Flow, FlowSchema } from "./flow-types";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

/**
 * Resolve a chave a ser usada: a do próprio usuário (BYOK) tem prioridade;
 * senão, cai na chave da plataforma (variável de ambiente).
 */
export function resolveApiKey(userKey?: string | null): string | undefined {
  return userKey?.trim() || process.env.ANTHROPIC_API_KEY || undefined;
}

function getClient(userKey?: string | null): Anthropic | null {
  const apiKey = resolveApiKey(userKey);
  if (!apiKey) return null;
  return new Anthropic({ apiKey });
}

// O catálogo de ações vira parte estável do prompt -> cacheado.
const ACTIONS_DOC = (Object.entries(ACTION_CATALOG) as [string, { title: string; description: string }][])
  .map(([type, meta]) => `- "${type}": ${meta.title} — ${meta.description}`)
  .join("\n");

const SYSTEM_PROMPT = `Você é o motor de criação de automações do Automatite, uma plataforma no-code.
Sua tarefa: a partir da descrição do usuário, produzir UMA automação como JSON válido.

Tipos de GATILHO (trigger.type) permitidos: "webhook", "form_submission", "schedule".
Tipos de AÇÃO (action.type) permitidos:
${ACTIONS_DOC}

Regras:
- Responda APENAS com JSON válido, sem markdown, sem comentários, sem texto antes ou depois.
- Use placeholders no formato {campo} dentro dos params quando o valor vier do payload do gatilho
  (ex.: {email}, {nome}, {data}). O sistema substitui esses placeholders em tempo de execução.
- Escolha o conjunto mínimo de ações que resolve o pedido, na ordem correta.
- Sempre inclua "label" curto e em português em cada ação.
- Se o usuário citar um app (Asana, Gmail, Pipedrive, Twilio, Google Sheets...), coloque-o em params.app/params.provider.

Formato EXATO de saída:
{
  "name": "string curto",
  "description": "string",
  "category": "marketing | saude | ecommerce | vendas | rh | geral",
  "trigger": { "type": "webhook", "config": {} },
  "actions": [
    { "type": "send_email", "label": "Enviar confirmação", "params": { "to": "{email}", "subject": "...", "body": "..." } }
  ]
}`;

export type GenerateInput = {
  description: string; // o que o cliente quer automatizar
  apps?: string; // apps que ele usa (texto livre)
  fields?: string; // dados importantes (texto livre)
};

export type GenerateResult = {
  flow: Flow;
  usedAI: boolean; // false quando caiu no fallback de demonstração
};

/**
 * Gera um fluxo a partir da descrição em linguagem natural.
 * Se não houver ANTHROPIC_API_KEY, usa um fallback determinístico para demo.
 */
export async function generateFlow(input: GenerateInput, userKey?: string | null): Promise<GenerateResult> {
  const client = getClient(userKey);
  if (!client) {
    return { flow: fallbackFlow(input), usedAI: false };
  }

  const userMessage = [
    `O que automatizar: ${input.description}`,
    input.apps ? `Apps usados: ${input.apps}` : "",
    input.fields ? `Dados importantes: ${input.fields}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const resp = await client.messages.create({
    model: MODEL,
    max_tokens: 1500,
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        // System prompt é estável entre chamadas -> cache para reduzir custo/latência.
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: userMessage }],
  });

  const text = resp.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  const parsed = JSON.parse(extractJson(text));
  const flow = FlowSchema.parse(parsed);
  return { flow, usedAI: true };
}

/** Extrai o primeiro bloco JSON, tolerando cercas de markdown acidentais. */
function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end !== -1) return text.slice(start, end + 1);
  return text.trim();
}

/** Fluxo de demonstração quando não há chave de API — mantém o app utilizável. */
function fallbackFlow(input: GenerateInput): Flow {
  return {
    name: "Automação (demo)",
    description: input.description.slice(0, 140) || "Gerada em modo demonstração (sem chave de API).",
    category: "geral",
    trigger: { type: "webhook", config: {} },
    actions: [
      {
        type: "log",
        label: "Registrar recebimento",
        params: { message: "Gatilho recebido para: {nome}" },
      },
      {
        type: "send_email",
        label: "Enviar e-mail de confirmação",
        params: {
          to: "{email}",
          subject: "Recebemos sua solicitação",
          body: "Olá {nome}, recebemos seus dados e já estamos cuidando de tudo.",
        },
      },
    ],
  };
}
