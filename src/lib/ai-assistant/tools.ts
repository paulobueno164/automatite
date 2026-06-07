import type Anthropic from "@anthropic-ai/sdk";

export type ToolKind = "read" | "write";

export type AssistantToolDef = {
  name: string;
  kind: ToolKind;
  description: string;
  input_schema: Anthropic.Tool["input_schema"];
  confirmLabel?: (input: Record<string, unknown>) => string;
};

export const ASSISTANT_TOOLS: AssistantToolDef[] = [
  {
    name: "get_account_overview",
    kind: "read",
    description: "Resumo da conta: plano, limites, uso do mês, integrações conectadas, contadores de automações/leads/tarefas.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "list_automations",
    kind: "read",
    description: "Lista todas as automações do usuário com id, nome, status ativo/inativo e quantidade de execuções.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_automation_details",
    kind: "read",
    description: "Detalhes de uma automação: fluxo, gatilho, ações, link do formulário, prontidão e últimas execuções.",
    input_schema: {
      type: "object",
      properties: { automation_id: { type: "string", description: "ID da automação" } },
      required: ["automation_id"],
    },
  },
  {
    name: "list_templates",
    kind: "read",
    description: "Lista templates prontos para criar automações.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "list_leads",
    kind: "read",
    description: "Lista leads do CRM. Pode filtrar por status.",
    input_schema: {
      type: "object",
      properties: {
        status: { type: "string", description: "new | contacted | qualified | won | lost" },
        limit: { type: "number", description: "Máximo de resultados (padrão 20)" },
      },
    },
  },
  {
    name: "get_lead_details",
    kind: "read",
    description: "Detalhe de um lead com histórico de eventos e dados do formulário.",
    input_schema: {
      type: "object",
      properties: { lead_id: { type: "string" } },
      required: ["lead_id"],
    },
  },
  {
    name: "list_records",
    kind: "read",
    description: "Lista registros salvos pelas automações (planilha interna).",
    input_schema: {
      type: "object",
      properties: { label: { type: "string", description: "Filtrar por nome da lista" }, limit: { type: "number" } },
    },
  },
  {
    name: "list_tasks",
    kind: "read",
    description: "Lista tarefas internas. Pode filtrar por status open ou done.",
    input_schema: {
      type: "object",
      properties: { status: { type: "string", enum: ["open", "done"] } },
    },
  },
  {
    name: "list_integrations",
    kind: "read",
    description: "Lista integrações conectadas (sem expor senhas).",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "list_api_keys",
    kind: "read",
    description: "Lista chaves de API do CRM (só prefixo, nunca a chave completa).",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_platform_services",
    kind: "read",
    description: "Status dos serviços inclusos na plataforma (SMS, e-mail Resend, CRM, registros, IA).",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "search_leads",
    kind: "read",
    description: "Busca leads por nome, e-mail, telefone ou empresa (texto parcial).",
    input_schema: {
      type: "object",
      properties: { query: { type: "string" }, limit: { type: "number" } },
      required: ["query"],
    },
  },
  {
    name: "list_executions",
    kind: "read",
    description: "Lista execuções de automações. Pode filtrar por automation_id.",
    input_schema: {
      type: "object",
      properties: {
        automation_id: { type: "string" },
        limit: { type: "number" },
      },
    },
  },
  {
    name: "get_execution_details",
    kind: "read",
    description: "Detalhe completo de uma execução com log passo a passo.",
    input_schema: {
      type: "object",
      properties: { execution_id: { type: "string" } },
      required: ["execution_id"],
    },
  },
  {
    name: "get_form_config",
    kind: "read",
    description:
      "Lê configuração do formulário público (campos, visual, customHtml, mensagem de sucesso).",
    input_schema: {
      type: "object",
      properties: { automation_id: { type: "string" } },
      required: ["automation_id"],
    },
  },
  {
    name: "create_automation_from_template",
    kind: "write",
    description: "Cria uma nova automação a partir de um template (use list_templates para ver ids).",
    input_schema: {
      type: "object",
      properties: { template_id: { type: "string" } },
      required: ["template_id"],
    },
    confirmLabel: (i) => `Criar automação do template "${i.template_id}"`,
  },
  {
    name: "create_automation_from_description",
    kind: "write",
    description: "Gera e cria uma automação nova usando IA a partir de uma descrição em português.",
    input_schema: {
      type: "object",
      properties: {
        description: { type: "string" },
        apps: { type: "string", description: "Apps mencionados (opcional)" },
        fields: { type: "string", description: "Campos importantes (opcional)" },
      },
      required: ["description"],
    },
    confirmLabel: (i) => `Criar automação com IA: "${String(i.description).slice(0, 60)}…"`,
  },
  {
    name: "update_automation",
    kind: "write",
    description: "Atualiza nome, descrição ou fluxo completo de uma automação.",
    input_schema: {
      type: "object",
      properties: {
        automation_id: { type: "string" },
        name: { type: "string" },
        description: { type: "string" },
        flow_json: { type: "string", description: "Fluxo completo como JSON string" },
      },
      required: ["automation_id"],
    },
    confirmLabel: (i) => `Atualizar automação ${i.automation_id}`,
  },
  {
    name: "set_automation_active",
    kind: "write",
    description: "Ativa ou desativa uma automação.",
    input_schema: {
      type: "object",
      properties: {
        automation_id: { type: "string" },
        active: { type: "boolean" },
      },
      required: ["automation_id", "active"],
    },
    confirmLabel: (i) => `${i.active ? "Ativar" : "Desativar"} automação ${i.automation_id}`,
  },
  {
    name: "delete_automation",
    kind: "write",
    description: "Exclui permanentemente uma automação.",
    input_schema: {
      type: "object",
      properties: { automation_id: { type: "string" } },
      required: ["automation_id"],
    },
    confirmLabel: (i) => `Excluir automação ${i.automation_id} permanentemente`,
  },
  {
    name: "duplicate_automation",
    kind: "write",
    description: "Duplica uma automação existente (cópia inativa).",
    input_schema: {
      type: "object",
      properties: { automation_id: { type: "string" } },
      required: ["automation_id"],
    },
    confirmLabel: (i) => `Duplicar automação ${i.automation_id}`,
  },
  {
    name: "update_automation_action",
    kind: "write",
    description: "Edita um passo específico do fluxo (índice 0-based). Pode alterar label, type e params_json.",
    input_schema: {
      type: "object",
      properties: {
        automation_id: { type: "string" },
        action_index: { type: "number" },
        label: { type: "string" },
        type: { type: "string", description: "send_email, upsert_lead, etc." },
        params_json: { type: "string" },
      },
      required: ["automation_id", "action_index"],
    },
    confirmLabel: (i) => `Editar passo ${Number(i.action_index) + 1} da automação ${i.automation_id}`,
  },
  {
    name: "add_automation_action",
    kind: "write",
    description: "Adiciona um passo ao fluxo. Envie type, label e params_json.",
    input_schema: {
      type: "object",
      properties: {
        automation_id: { type: "string" },
        type: { type: "string" },
        label: { type: "string" },
        params_json: { type: "string" },
        position: { type: "number", description: "Índice onde inserir (padrão: final)" },
      },
      required: ["automation_id", "type"],
    },
    confirmLabel: (i) => `Adicionar passo "${i.type}" na automação ${i.automation_id}`,
  },
  {
    name: "remove_automation_action",
    kind: "write",
    description: "Remove um passo do fluxo pelo índice (0-based).",
    input_schema: {
      type: "object",
      properties: { automation_id: { type: "string" }, action_index: { type: "number" } },
      required: ["automation_id", "action_index"],
    },
    confirmLabel: (i) => `Remover passo ${Number(i.action_index) + 1} da automação ${i.automation_id}`,
  },
  {
    name: "set_automation_schedule",
    kind: "write",
    description: "Define ou altera agendamento cron de uma automação. Muda o gatilho para schedule.",
    input_schema: {
      type: "object",
      properties: {
        automation_id: { type: "string" },
        cron: { type: "string", description: "Ex: 0 9 * * *" },
      },
      required: ["automation_id", "cron"],
    },
    confirmLabel: (i) => `Agendar automação ${i.automation_id} com cron "${i.cron}"`,
  },
  {
    name: "update_email_layout",
    kind: "write",
    description: "Atualiza layout visual dos e-mails (rodapé, cor, HTML) sem retestar SMTP.",
    input_schema: {
      type: "object",
      properties: {
        template_footer: { type: "string" },
        template_accent_color: { type: "string" },
        template_html: { type: "string" },
      },
    },
    confirmLabel: () => "Atualizar aparência dos e-mails",
  },
  {
    name: "update_form_config",
    kind: "write",
    description:
      "Atualiza configuração do formulário (campos, cores, customHtml, sucesso). HTML exige {campos} ou cada {campo:id}. Prefira form_update_html para só o HTML.",
    input_schema: {
      type: "object",
      properties: {
        automation_id: { type: "string" },
        form_config_json: { type: "string", description: "FormConfig JSON" },
      },
      required: ["automation_id", "form_config_json"],
    },
    confirmLabel: () => "Atualizar formulário",
  },
  {
    name: "form_add_field",
    kind: "write",
    description:
      "Adiciona campo ao formulário. Se o HTML usa {campo:id} individuais (sem {campos}), atualize o HTML depois com form_update_html.",
    input_schema: {
      type: "object",
      properties: {
        automation_id: { type: "string" },
        label: { type: "string" },
        field_type: { type: "string", enum: ["text", "email", "tel", "textarea", "number", "select"] },
        required: { type: "boolean" },
        placeholder: { type: "string" },
        field_id: { type: "string" },
        options: { type: "string", description: "Para select: opções separadas por vírgula" },
      },
      required: ["automation_id", "label"],
    },
    confirmLabel: (i) => `Adicionar campo "${i.label}" ao formulário`,
  },
  {
    name: "form_remove_field",
    kind: "write",
    description: "Remove campo do formulário pelo field_id.",
    input_schema: {
      type: "object",
      properties: { automation_id: { type: "string" }, field_id: { type: "string" } },
      required: ["automation_id", "field_id"],
    },
    confirmLabel: (i) => `Remover campo "${i.field_id}" do formulário`,
  },
  {
    name: "form_update_field",
    kind: "write",
    description: "Atualiza um campo existente do formulário.",
    input_schema: {
      type: "object",
      properties: {
        automation_id: { type: "string" },
        field_id: { type: "string" },
        label: { type: "string" },
        field_type: { type: "string" },
        required: { type: "boolean" },
        placeholder: { type: "string" },
      },
      required: ["automation_id", "field_id"],
    },
    confirmLabel: (i) => `Atualizar campo "${i.field_id}" do formulário`,
  },
  {
    name: "form_update_style",
    kind: "write",
    description: "Atualiza visual do formulário: cores, fundo, botão, imagem de fundo.",
    input_schema: {
      type: "object",
      properties: {
        automation_id: { type: "string" },
        background_color: { type: "string" },
        background_image_url: { type: "string" },
        accent_color: { type: "string" },
        button_label: { type: "string" },
        card_background: { type: "string" },
      },
      required: ["automation_id"],
    },
    confirmLabel: () => "Atualizar visual do formulário",
  },
  {
    name: "form_update_success_screen",
    kind: "write",
    description: "Personaliza tela após envio do formulário.",
    input_schema: {
      type: "object",
      properties: {
        automation_id: { type: "string" },
        title: { type: "string" },
        message: { type: "string" },
        show_another_button: { type: "boolean" },
        another_button_label: { type: "string" },
      },
      required: ["automation_id"],
    },
    confirmLabel: (i) => `Atualizar mensagem pós-envio do formulário`,
  },
  {
    name: "form_set_title",
    kind: "write",
    description: "Altera título e descrição exibidos no formulário público.",
    input_schema: {
      type: "object",
      properties: {
        automation_id: { type: "string" },
        title: { type: "string" },
        description: { type: "string" },
      },
      required: ["automation_id"],
    },
    confirmLabel: (i) => `Alterar título do formulário`,
  },
  {
    name: "form_update_html",
    kind: "write",
    description:
      "Define HTML personalizado do formulário. OBRIGATÓRIO incluir {campos} ou cada {campo:id} para todos os campos — os inputs são gerados pelo sistema. Opcional: {titulo}, {descricao}, {botao}, {erro}, {cor}, {fundo_card}. Envie vazio para remover.",
    input_schema: {
      type: "object",
      properties: {
        automation_id: { type: "string" },
        custom_html: { type: "string", description: "HTML completo ou string vazia para remover" },
      },
      required: ["automation_id"],
    },
    confirmLabel: () => "Aplicar novo visual ao formulário",
  },
  {
    name: "test_automation",
    kind: "write",
    description: "Executa teste de uma automação ativa com um payload JSON de exemplo.",
    input_schema: {
      type: "object",
      properties: {
        automation_id: { type: "string" },
        payload_json: { type: "string", description: 'JSON ex: {"nome":"Maria","email":"a@b.com"}' },
      },
      required: ["automation_id", "payload_json"],
    },
    confirmLabel: (i) => `Executar teste da automação ${i.automation_id}`,
  },
  {
    name: "update_lead_status",
    kind: "write",
    description: "Altera status de um lead no CRM.",
    input_schema: {
      type: "object",
      properties: {
        lead_id: { type: "string" },
        status: { type: "string", enum: ["new", "contacted", "qualified", "won", "lost"] },
      },
      required: ["lead_id", "status"],
    },
    confirmLabel: (i) => `Alterar lead ${i.lead_id} para status "${i.status}"`,
  },
  {
    name: "create_lead",
    kind: "write",
    description: "Cria ou atualiza um lead manualmente no CRM.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string" },
        email: { type: "string" },
        phone: { type: "string" },
        company: { type: "string" },
        status: { type: "string" },
        note: { type: "string" },
        extra_data_json: { type: "string", description: "Campos extras como JSON" },
      },
      required: ["name"],
    },
    confirmLabel: (i) => `Criar/atualizar lead "${i.name}"`,
  },
  {
    name: "update_lead",
    kind: "write",
    description: "Atualiza dados de um lead (nome, e-mail, telefone, empresa, campos extras).",
    input_schema: {
      type: "object",
      properties: {
        lead_id: { type: "string" },
        name: { type: "string" },
        email: { type: "string" },
        phone: { type: "string" },
        company: { type: "string" },
        extra_data_json: { type: "string" },
      },
      required: ["lead_id"],
    },
    confirmLabel: (i) => `Atualizar dados do lead ${i.lead_id}`,
  },
  {
    name: "delete_lead",
    kind: "write",
    description: "Exclui permanentemente um lead e seu histórico.",
    input_schema: {
      type: "object",
      properties: { lead_id: { type: "string" } },
      required: ["lead_id"],
    },
    confirmLabel: (i) => `Excluir lead ${i.lead_id} permanentemente`,
  },
  {
    name: "update_task_status",
    kind: "write",
    description: "Marca tarefa como concluída (done) ou pendente (open).",
    input_schema: {
      type: "object",
      properties: {
        task_id: { type: "string" },
        status: { type: "string", enum: ["open", "done"] },
      },
      required: ["task_id", "status"],
    },
    confirmLabel: (i) => `Marcar tarefa ${i.task_id} como ${i.status}`,
  },
  {
    name: "create_task",
    kind: "write",
    description: "Cria uma tarefa interna manualmente.",
    input_schema: {
      type: "object",
      properties: { title: { type: "string" } },
      required: ["title"],
    },
    confirmLabel: (i) => `Criar tarefa "${i.title}"`,
  },
  {
    name: "delete_task",
    kind: "write",
    description: "Exclui uma tarefa interna.",
    input_schema: {
      type: "object",
      properties: { task_id: { type: "string" } },
      required: ["task_id"],
    },
    confirmLabel: (i) => `Excluir tarefa ${i.task_id}`,
  },
  {
    name: "create_record",
    kind: "write",
    description: "Cria registro manual na planilha interna.",
    input_schema: {
      type: "object",
      properties: {
        label: { type: "string", description: "Nome da lista, ex: Leads" },
        data_json: { type: "string", description: "Dados como JSON" },
      },
      required: ["label", "data_json"],
    },
    confirmLabel: (i) => `Criar registro na lista "${i.label}"`,
  },
  {
    name: "delete_record",
    kind: "write",
    description: "Exclui um registro da planilha interna.",
    input_schema: {
      type: "object",
      properties: { record_id: { type: "string" } },
      required: ["record_id"],
    },
    confirmLabel: (i) => `Excluir registro ${i.record_id}`,
  },
  {
    name: "connect_integration",
    kind: "write",
    description:
      "Conecta ou atualiza integração. Envie provider e credentials_json com os campos do provider (ex: smtp: host, port, user, password, fromEmail).",
    input_schema: {
      type: "object",
      properties: {
        provider: { type: "string" },
        credentials_json: { type: "string", description: "Objeto JSON com credenciais" },
        test_connection: { type: "boolean", description: "Testar SMTP antes de salvar (padrão true)" },
      },
      required: ["provider", "credentials_json"],
    },
    confirmLabel: (i) => `Conectar integração ${i.provider}`,
  },
  {
    name: "disconnect_integration",
    kind: "write",
    description: "Desconecta uma integração (smtp, google_sheets, pipedrive, trello, asana, whatsapp, twilio).",
    input_schema: {
      type: "object",
      properties: { provider: { type: "string" } },
      required: ["provider"],
    },
    confirmLabel: (i) => `Desconectar integração ${i.provider}`,
  },
  {
    name: "create_api_key",
    kind: "write",
    description: "Gera nova chave de API do CRM. A chave completa só é retornada uma vez.",
    input_schema: {
      type: "object",
      properties: { name: { type: "string" } },
    },
    confirmLabel: () => "Gerar nova chave de API do CRM",
  },
  {
    name: "revoke_api_key",
    kind: "write",
    description: "Revoga uma chave de API pelo id, ou todas se omitir id.",
    input_schema: {
      type: "object",
      properties: { key_id: { type: "string", description: "Omitir para revogar todas" } },
    },
    confirmLabel: (i) => (i.key_id ? `Revogar chave ${i.key_id}` : "Revogar TODAS as chaves de API"),
  },
  {
    name: "set_anthropic_key",
    kind: "write",
    description: "Salva chave Anthropic BYOK do usuário (sk-ant-...).",
    input_schema: {
      type: "object",
      properties: { api_key: { type: "string" } },
      required: ["api_key"],
    },
    confirmLabel: () => "Salvar chave de IA (Anthropic)",
  },
  {
    name: "remove_anthropic_key",
    kind: "write",
    description: "Remove a chave Anthropic BYOK do usuário.",
    input_schema: { type: "object", properties: {} },
    confirmLabel: () => "Remover chave de IA (Anthropic)",
  },
];

export const TOOL_MAP = new Map(ASSISTANT_TOOLS.map((t) => [t.name, t]));

export function toAnthropicTools(): Anthropic.Tool[] {
  return ASSISTANT_TOOLS.map(({ name, description, input_schema }) => ({
    name,
    description,
    input_schema,
  }));
}
