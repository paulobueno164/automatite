import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { resolveApiKey } from "../anthropic";
import { TOOL_MAP, toAnthropicTools } from "./tools";
import { executeAssistantTool } from "./execute";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
const MAX_TOOL_ROUNDS = 8;

export type ChatMessage = { role: "user" | "assistant"; content: string };

export type PendingConfirmation = {
  tool: string;
  input: Record<string, unknown>;
  label: string;
};

export type AssistantResponse = {
  reply: string;
  pendingConfirmation?: PendingConfirmation;
  pendingConfirmations?: PendingConfirmation[];
  usedAI: boolean;
};

const SYSTEM = `Você é o assistente do Automatite — plataforma de automações no-code em português do Brasil.

Você pode CONSULTAR e MODIFICAR praticamente tudo na conta do usuário:
- Automações: criar, duplicar, editar passos, agendar, ativar, testar, excluir
- Formulários: campos, cores, HTML personalizado (com placeholders obrigatórios), mensagem pós-envio
- E-mails: layout visual (update_email_layout)
- CRM: buscar, criar, editar, excluir leads
- Tarefas e registros: criar, concluir, excluir
- Integrações, chaves API, chave Anthropic

REGRAS:
1. Responda em português brasileiro, claro e amigável para leigos — como um atendente humano, não um desenvolvedor.
2. NUNCA use com o usuário termos técnicos: HTML, JSON, API, ID, placeholder, ferramenta, webhook, cron, código, template técnico. Diga "visual do formulário", "cor", "campo", "automação", "mensagem".
3. Ações de escrita exigem confirmação do usuário. Ao propor uma mudança, SEMPRE chame a ferramenta de escrita correspondente na MESMA resposta — isso faz o botão de confirmação aparecer automaticamente. NUNCA peça confirmação só com texto sem chamar a ferramenta; NUNCA espere o usuário dizer "sim" antes de chamar a ferramenta.
4. Junto com a ferramenta, descreva em linguagem simples o que vai mudar (ex: "vou deixar o formulário com visual cyberpunk"). Não explique como funciona por baixo dos panos.
5. Quando o usuário confirmar, a ação JÁ é executada pelo sistema. Não diga "vou aplicar agora" ou "estou fazendo" — apenas confirme o que foi feito, de forma curta e amigável.
6. NUNCA mude plano de assinatura — oriente ir em Planos.
7. NUNCA altere senha da conta — oriente ir em Configurações → Senha da conta.
8. Use ferramentas de leitura antes de agir (list_*, search_*, get_*).
9. Para editar fluxo, prefira update_automation_action em vez de flow_json completo.
10. Para formulário, use form_add_field, form_update_style, form_update_html etc.
11. HTML do formulário (uso interno): mantenha {campos} ou cada {campo:id}. Em <style>, NUNCA use body/html/:root — use classes próprias (ex: .meu-card); o sistema isola o CSS ao formulário.
12. Novas capacidades de Automação:
    - "analyze_image": use para ler dados de imagens (recibos, documentos, fotos). Requer params: { "image_url": "{placeholder_da_imagem}", "prompt": "o que procurar" }.
    - "condition": use para criar fluxos inteligentes. O passo "condition" avalia uma pergunta e você deve colocar as ações seguintes dentro de "if_true" ou "if_false" nos params do "condition". Ex: { "type": "condition", "params": { "prompt": "É urgente?", "if_true": [...ações...], "if_false": [...ações...] } }.
13. Não invente IDs internos. Seja proativo e conciso.`;

type RunOpts = {
  userId: string;
  userEmail: string;
  userKey?: string | null;
  messages: ChatMessage[];
  appOrigin: string;
  confirmedTool?: { name: string; input: Record<string, unknown> };
};

function getClient(userKey?: string | null): Anthropic | null {
  const apiKey = resolveApiKey(userKey);
  if (!apiKey) return null;
  return new Anthropic({ apiKey });
}

function toolResultContent(result: Awaited<ReturnType<typeof executeAssistantTool>>): string {
  return JSON.stringify(result.ok ? result.data : { error: result.error });
}

export async function runAssistantChat(opts: RunOpts): Promise<AssistantResponse> {
  const client = getClient(opts.userKey);
  if (!client) {
    return {
      usedAI: false,
      reply:
        "O assistente precisa de uma chave de IA configurada. Vá em Configurações → Inteligência artificial, ou peça ao administrador da plataforma.",
    };
  }

  const anthropicMessages: Anthropic.MessageParam[] = opts.messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  if (opts.confirmedTool) {
    const result = await executeAssistantTool(
      opts.userId,
      opts.userEmail,
      opts.confirmedTool.name,
      opts.confirmedTool.input,
      opts.appOrigin
    );
    if (!result.ok) {
      return { reply: `Não foi possível executar: ${result.error}`, usedAI: true };
    }
    anthropicMessages.push({
      role: "user",
      content: [
        {
          type: "text",
          text: `[Ação confirmada e já executada] ${opts.confirmedTool.name}: ${toolResultContent(result)}. Diga ao usuário o que mudou, em 1-2 frases simples, sem termos técnicos. A ação já está pronta — não diga que vai fazer.`,
        },
      ],
    });
    const final = await client.messages.create({
      model: MODEL,
      max_tokens: 1500,
      system: SYSTEM,
      messages: anthropicMessages,
    });
    const text = final.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    return { reply: text, usedAI: true };
  }

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 2000,
      system: SYSTEM,
      tools: toAnthropicTools(),
      messages: anthropicMessages,
    });

    const textBlocks = response.content.filter((b): b is Anthropic.TextBlock => b.type === "text");
    const toolBlocks = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");

    if (response.stop_reason === "tool_use" && toolBlocks.length > 0) {
      anthropicMessages.push({ role: "assistant", content: response.content });

      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      const pendingList: PendingConfirmation[] = [];

      for (const block of toolBlocks) {
        const def = TOOL_MAP.get(block.name);
        const input = block.input as Record<string, unknown>;

        if (def?.kind === "write") {
          pendingList.push({
            tool: block.name,
            input,
            label: def.confirmLabel?.(input) ?? `Executar ${block.name}`,
          });
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: JSON.stringify({
              status: "awaiting_confirmation",
              message:
                "Aguardando confirmação. Explique ao usuário o que vai mudar em linguagem simples, sem termos técnicos, e peça que confirme. Não diga que já executou.",
            }),
          });
        } else {
          const result = await executeAssistantTool(opts.userId, opts.userEmail, block.name, input, opts.appOrigin);
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: toolResultContent(result),
          });
        }
      }

      if (pendingList.length > 0) {
        const interim = await client.messages.create({
          model: MODEL,
          max_tokens: 800,
          system: SYSTEM,
          messages: [
            ...anthropicMessages,
            { role: "user", content: toolResults },
          ],
        });
        const reply = interim.content
          .filter((b): b is Anthropic.TextBlock => b.type === "text")
          .map((b) => b.text)
          .join("");
        return {
          reply,
          pendingConfirmation: pendingList[0],
          pendingConfirmations: pendingList,
          usedAI: true,
        };
      }

      anthropicMessages.push({ role: "user", content: toolResults });
      continue;
    }

    const reply = textBlocks.map((b) => b.text).join("") || "Como posso ajudar?";
    return { reply, usedAI: true };
  }

  return { reply: "Precisei de muitas etapas — pode reformular o pedido?", usedAI: true };
}
