import { z } from "zod";

/**
 * Tipos de gatilho (trigger) suportados.
 * - webhook: dispara quando chega um POST em /api/trigger/[id]
 * - form_submission: idem (semântica de "formulário recebido")
 * - schedule: reservado para agendamentos (cron) — ainda não executado automaticamente
 */
export const TriggerSchema = z.object({
  type: z.enum(["webhook", "form_submission", "schedule"]),
  // Campos extras dependentes do tipo (ex.: form_id, cron, etc.)
  config: z.record(z.any()).optional().default({}),
});

/**
 * Tipos de ação suportados pelo Flow Engine.
 * Mantemos um conjunto pequeno e bem definido — é o que a IA pode usar.
 */
export const ActionTypeEnum = z.enum([
  "send_email", // envia e-mail via Resend
  "send_sms", // envia SMS via Twilio
  "send_whatsapp", // envia WhatsApp via Cloud API
  "upsert_lead", // cria/atualiza contato no CRM interno
  "create_task", // cria tarefa em Pipedrive, Trello ou Asana
  "append_sheet", // adiciona linha em planilha Google Sheets
  "http_request", // chamada HTTP real (webhook genérico de saída)
  "ai_generate", // gera texto com a IA (ex.: resposta personalizada)
  "analyze_image", // analisa uma imagem com IA (Visão)
  "condition", // ramificação condicional inteligente com IA
  "delay", // aguarda um tempo antes de continuar
  "send_slack", // envia mensagem para o Slack
  "transform", // transforma dados usando IA
  "log", // apenas registra uma mensagem
]);

export const ActionSchema = z.object({
  type: ActionTypeEnum,
  // Rótulo amigável mostrado na UI
  label: z.string().optional(),
  // Parâmetros da ação. Aceita placeholders {campo} substituídos pelo payload.
  params: z.record(z.any()).optional().default({}),
});

export const FlowSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().default(""),
  category: z.string().optional().default("geral"),
  trigger: TriggerSchema,
  actions: z.array(ActionSchema).min(1),
});

export type Trigger = z.infer<typeof TriggerSchema>;
export type ActionType = z.infer<typeof ActionTypeEnum>;
export type Action = z.infer<typeof ActionSchema>;
export type Flow = z.infer<typeof FlowSchema>;

export type ExecutionStep = {
  action: ActionType;
  label: string;
  status: "success" | "error" | "skipped";
  detail: string;
  output?: unknown;
};

/** Catálogo legível das ações — usado na UI e no prompt da IA. */
export const ACTION_CATALOG: Record<ActionType, { title: string; description: string }> = {
  send_email: { title: "Enviar e-mail", description: "Dispara um e-mail (destinatário, assunto, corpo)." },
  send_sms: { title: "Enviar SMS", description: "Envia uma mensagem SMS (telefone, texto)." },
  send_whatsapp: { title: "Enviar WhatsApp", description: "Envia mensagem no WhatsApp (telefone, texto)." },
  upsert_lead: { title: "Salvar no CRM", description: "Cria ou atualiza um contato no CRM do Automatite com histórico." },
  create_task: { title: "Criar tarefa", description: "Cria uma tarefa de follow-up no Automatite ou app externo." },
  append_sheet: { title: "Salvar registro", description: "Salva os dados em Registros (Automatite) ou no Google Sheets." },
  http_request: { title: "Chamada HTTP", description: "Faz uma requisição HTTP para um endpoint externo." },
  ai_generate: { title: "Gerar com IA", description: "Usa a IA para gerar um texto (ex.: resposta personalizada)." },
  analyze_image: { title: "Analisar imagem", description: "Usa a visão da IA para extrair dados ou descrever uma imagem." },
  condition: { title: "Condição (IA)", description: "Decide qual caminho seguir baseado em uma pergunta para a IA." },
  delay: { title: "Aguardar", description: "Pausa a execução por alguns segundos ou minutos." },
  send_slack: { title: "Enviar Slack", description: "Envia uma mensagem para um canal ou usuário no Slack." },
  transform: { title: "Transformar (IA)", description: "Usa a IA para formatar, limpar ou extrair dados." },
  log: { title: "Registrar log", description: "Apenas registra uma mensagem no histórico." },
};
