import { Flow } from "./flow-types";

export type Template = {
  id: string;
  emoji: string;
  segment: string; // segmento de mercado
  flow: Flow;
};

/**
 * Templates pré-construídos (Modelo 1 da estratégia).
 * O cliente escolhe um, ajusta os dados e ativa — custo zero de configuração para você.
 */
export const TEMPLATES: Template[] = [
  {
    id: "lead-crm-email",
    emoji: "🎯",
    segment: "Agência de Marketing",
    flow: {
      name: "Novo lead → CRM + e-mail",
      description: "Quando um lead chega pelo formulário, cria contato no CRM e envia e-mail de boas-vindas.",
      category: "marketing",
      trigger: { type: "form_submission", config: { form_id: "lead_form" } },
      actions: [
        { type: "upsert_lead", label: "Salvar no CRM", params: { name: "{nome}", email: "{email}", status: "new", note: "Lead recebido pelo formulário" } },
        {
          type: "send_email",
          label: "E-mail de boas-vindas",
          params: {
            to: "{email}",
            subject: "Bem-vindo, {nome}!",
            body: "Olá {nome},\n\nObrigado pelo seu interesse! Recebemos seus dados e em breve nossa equipe entrará em contato.\n\nAtenciosamente,\nEquipe",
          },
        },
        { type: "append_sheet", label: "Salvar lead", params: { app: "automatite", sheet: "Leads" } },
      ],
    },
  },
  {
    id: "agendamento-saude",
    emoji: "🏥",
    segment: "Consultório / Clínica",
    flow: {
      name: "Agendamento → confirmação SMS",
      description: "Paciente preenche formulário de agendamento: cria o evento, confirma por SMS e registra na planilha.",
      category: "saude",
      trigger: { type: "form_submission", config: { form_id: "scheduling_form" } },
      actions: [
        { type: "create_task", label: "Criar agendamento", params: { app: "automatite", title: "{nome} - Agendamento {data}" } },
        { type: "send_sms", label: "Confirmar por SMS", params: { to: "{telefone}", text: "Agendamento confirmado para {data}." } },
        { type: "append_sheet", label: "Salvar agendamento", params: { app: "automatite", sheet: "Agendamentos" } },
      ],
    },
  },
  {
    id: "whatsapp-ticket",
    emoji: "💬",
    segment: "Atendimento / Suporte",
    flow: {
      name: "Mensagem WhatsApp → ticket + confirmação",
      description: "Cliente responde no WhatsApp: abre um ticket e envia confirmação automática.",
      category: "vendas",
      trigger: { type: "webhook", config: {} },
      actions: [
        { type: "create_task", label: "Abrir ticket", params: { app: "automatite", title: "Ticket de {nome}" } },
        { type: "send_whatsapp", label: "Enviar confirmação", params: { to: "{telefone}", text: "Recebemos sua mensagem, {nome}! Já estamos atendendo." } },
      ],
    },
  },
  {
    id: "form-relatorio",
    emoji: "📊",
    segment: "Operações",
    flow: {
      name: "Formulário → relatório automático",
      description: "Cada formulário recebido alimenta uma planilha e notifica o time.",
      category: "geral",
      trigger: { type: "form_submission", config: {} },
      actions: [
        { type: "append_sheet", label: "Salvar resposta", params: { app: "automatite", sheet: "Respostas" } },
        { type: "send_email", label: "Notificar o time", params: { to: "time@empresa.com", subject: "Novo formulário recebido", body: "Nova resposta de {nome}." } },
      ],
    },
  },
  {
    id: "ecommerce-pedido",
    emoji: "🛒",
    segment: "E-commerce",
    flow: {
      name: "Novo pedido → confirmação + fulfillment",
      description: "Pedido recebido: confirma com o cliente por e-mail e cria tarefa de separação.",
      category: "ecommerce",
      trigger: { type: "webhook", config: {} },
      actions: [
        { type: "send_email", label: "Confirmar pedido", params: { to: "{email}", subject: "Pedido confirmado #{pedido}", body: "Olá {nome}, seu pedido foi confirmado!" } },
        { type: "create_task", label: "Criar tarefa de separação", params: { app: "automatite", title: "Separar pedido #{pedido}" } },
      ],
    },
  },
  {
    id: "lead-ia-personalizado",
    emoji: "🤖",
    segment: "Vendas (com IA)",
    flow: {
      name: "Lead → e-mail personalizado por IA",
      description: "Gera um e-mail sob medida com IA com base nos dados do lead e envia.",
      category: "vendas",
      trigger: { type: "form_submission", config: {} },
      actions: [
        { type: "ai_generate", label: "Gerar e-mail personalizado", params: { prompt: "Escreva um e-mail curto e amigável para o lead {nome} da empresa {empresa}." } },
        { type: "send_email", label: "Enviar e-mail", params: { to: "{email}", subject: "Uma ideia para a {empresa}", body: "{ai_output}" } },
      ],
    },
  },
];

export function getTemplate(id: string): Template | undefined {
  return TEMPLATES.find((t) => t.id === id);
}
