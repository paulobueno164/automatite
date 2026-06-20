import Anthropic from "@anthropic-ai/sdk";
import { Resend } from "resend";
import { Action, ExecutionStep } from "../flow-types";
import { Credentials } from "../provider-catalog";
import {
  asanaCreateTask,
  googleSheetsAppend,
  pipedriveCreateTask,
  slackSend,
  smtpSendEmail,
  trelloCreateCard,
  twilioSendSms,
  whatsappSend,
} from "../providers";
import { buildEmailContent } from "../email-template";
import { upsertLead, logLeadActivityByContact } from "../crm";
import { createInternalTask, saveInternalRecord } from "../internal-store";
import { isSafeUrl } from "../security";

export type EngineContext = {
  data: Record<string, unknown>;
  userId: string;
  automationId: string;
  executionId: string;
  apiKey?: string;
  /** Lazy loader for user integrations to avoid unnecessary DB queries and decryption. */
  getIntegrations: () => Promise<Record<string, Credentials>>;
};

/** Substitui placeholders {campo} numa string usando o contexto. */
function interpolate(value: unknown, ctx: EngineContext): unknown {
  if (typeof value === "string") {
    return value.replace(/\{([\w.]+)\}/g, (_, key) => {
      const v = ctx.data[key];
      return v === undefined || v === null ? `{${key}}` : String(v);
    });
  }
  if (Array.isArray(value)) return value.map((v) => interpolate(v, ctx));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, interpolate(v, ctx)])
    );
  }
  return value;
}

/**
 * Executa uma única ação e retorna o passo de log.
 * Cada ação tenta a integração real quando há credencial conectada; senão,
 * cai em modo mock (registra no log sem chamar o serviço externo).
 */
export async function runAction(action: Action, ctx: EngineContext): Promise<ExecutionStep> {
  const params = interpolate(action.params ?? {}, ctx) as Record<string, unknown>;
  const label = action.label || action.type;

  try {
    switch (action.type) {
      case "log":
        return ok(action, label, String(params.message ?? "(sem mensagem)"));

      case "delay": {
        const seconds = Math.min(Number(params.seconds ?? 5), 60); // Máximo 60s para evitar timeout do worker
        await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
        return ok(action, label, `Aguardou ${seconds} segundos`);
      }

      case "send_email": {
        const to = String(params.to ?? "");
        const subject = String(params.subject ?? "");
        if (!to) return fail(action, label, "Destinatário ausente");

        const integ = await ctx.getIntegrations();
        if (integ.smtp?.host && integ.smtp?.user && integ.smtp?.password) {
          const r = await smtpSendEmail(integ.smtp, params);
          await logLeadActivityByContact({
            userId: ctx.userId,
            email: to,
            type: "email_sent",
            title: "E-mail enviado",
            detail: subject || r.detail,
            automationId: ctx.automationId,
            executionId: ctx.executionId,
          });
          return ok(action, label, r.detail, r.output);
        }

        const resendKey = integ.resend?.apiKey || process.env.RESEND_API_KEY;
        if (resendKey) {
          const resend = new Resend(resendKey);
          const from = String(params.from ?? integ.resend?.fromEmail ?? process.env.EMAIL_FROM ?? "onboarding@resend.dev");
          const bodyText = String(params.body ?? "");
          const { html, text: plainText } = buildEmailContent(bodyText, {
            fromName: String(integ.resend?.fromName ?? ""),
            subject: subject || "(sem assunto)",
          });
          const { data, error } = await resend.emails.send({ from, to, subject: subject || "(sem assunto)", text: plainText, html });
          if (error) return fail(action, label, `E-mail: ${error.message}`);
          await logLeadActivityByContact({
            userId: ctx.userId,
            email: to,
            type: "email_sent",
            title: "E-mail enviado",
            detail: subject,
            automationId: ctx.automationId,
            executionId: ctx.executionId,
          });
          return ok(action, label, `E-mail enviado para ${to}`, { id: data?.id });
        }

        return fail(action, label, "Configure seu e-mail em Configurações → Seu e-mail (tutorial passo a passo)");
      }

      case "send_sms": {
        const integ = await ctx.getIntegrations();
        const creds =
          integ.twilio ??
          (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER
            ? {
                accountSid: process.env.TWILIO_ACCOUNT_SID,
                authToken: process.env.TWILIO_AUTH_TOKEN,
                fromNumber: process.env.TWILIO_FROM_NUMBER,
              }
            : undefined);
        if (!creds) return fail(action, label, "SMS não disponível — contate o suporte da plataforma");
        const r = await twilioSendSms(creds, params);
        await logLeadActivityByContact({
          userId: ctx.userId,
          phone: String(params.to ?? ""),
          type: "sms_sent",
          title: "SMS enviado",
          detail: r.detail,
          automationId: ctx.automationId,
          executionId: ctx.executionId,
        });
        return ok(action, label, r.detail, r.output);
      }

      case "send_slack": {
        const creds = integ.slack;
        if (!creds) return fail(action, label, "Slack não conectado — configure em Configurações → Integrações");
        const r = await slackSend(creds, params);
        return ok(action, label, r.detail, r.output);
      }

      case "send_whatsapp": {
        const integ = await ctx.getIntegrations();
        const creds = integ.whatsapp;
        if (!creds) return fail(action, label, "WhatsApp não conectado — configure em Configurações → Integrações");
        const r = await whatsappSend(creds, params);
        await logLeadActivityByContact({
          userId: ctx.userId,
          phone: String(params.to ?? ""),
          type: "whatsapp_sent",
          title: "WhatsApp enviado",
          detail: r.detail,
          automationId: ctx.automationId,
          executionId: ctx.executionId,
        });
        return ok(action, label, r.detail, r.output);
      }

      case "append_sheet": {
        const app = String(params.app ?? "automatite").toLowerCase();
        if (app === "automatite" || app === "registros" || app === "interno") {
          const sheetLabel = String(params.sheet ?? "Registros");
          const r = await saveInternalRecord({
            userId: ctx.userId,
            automationId: ctx.automationId,
            label: sheetLabel,
            data: ctx.data,
          });
          return ok(action, label, `Salvo em Registros → ${sheetLabel}`, r);
        }
        const integ = await ctx.getIntegrations();
        const creds = integ.google_sheets;
        if (!creds) return fail(action, label, "Google Sheets não conectado — use Registros (Automatite) ou conecte em Configurações");
        const r = await googleSheetsAppend(creds, params, ctx.data);
        return ok(action, label, r.detail, r.output);
      }

      case "upsert_lead": {
        const email = String(params.email ?? ctx.data.email ?? "");
        const name = String(params.name ?? ctx.data.nome ?? "");
        if (!email && !name && !params.phone && !ctx.data.telefone) {
          return fail(action, label, "Informe ao menos nome, e-mail ou telefone");
        }
        const r = await upsertLead({
          userId: ctx.userId,
          automationId: ctx.automationId,
          executionId: ctx.executionId,
          name,
          email,
          phone: String(params.phone ?? ctx.data.telefone ?? ""),
          company: String(params.company ?? ctx.data.empresa ?? ""),
          status: String(params.status ?? "new"),
          note: String(params.note ?? ""),
          data: ctx.data,
        });
        const verb = r.created ? "Lead criado" : "Lead atualizado";
        return ok(action, label, `${verb}: ${r.name}${r.email ? ` (${r.email})` : ""}`, r);
      }

      case "create_task": {
        const app = String(params.app ?? "automatite").toLowerCase();
        if (app === "automatite" || app === "interno" || app === "tarefas") {
          const title = String(params.title ?? "Nova tarefa");
          const r = await createInternalTask({ userId: ctx.userId, automationId: ctx.automationId, title });
          return ok(action, label, `Tarefa criada: "${r.title}"`, r);
        }
        const integ = await ctx.getIntegrations();
        if (app.includes("pipedrive")) {
          if (!integ.pipedrive) return fail(action, label, "Pipedrive não conectado — configure em Configurações → Integrações");
          const r = await pipedriveCreateTask(integ.pipedrive, params);
          return ok(action, label, r.detail, r.output);
        }
        if (app.includes("trello")) {
          if (!integ.trello) return fail(action, label, "Trello não conectado — configure em Configurações → Integrações");
          const r = await trelloCreateCard(integ.trello, params);
          return ok(action, label, r.detail, r.output);
        }
        if (app.includes("asana")) {
          if (!integ.asana) return fail(action, label, "Asana não conectado — configure em Configurações → Integrações");
          const r = await asanaCreateTask(integ.asana, params);
          return ok(action, label, r.detail, r.output);
        }
        return fail(action, label, `Aplicativo "${params.app ?? "?"}" não suportado. Use Automatite, Pipedrive, Trello ou Asana.`);
      }

      case "http_request": {
        const url = String(params.url ?? "");
        if (!url) return fail(action, label, "URL ausente");
        if (!isSafeUrl(url)) return fail(action, label, "URL não permitida (segurança)");
        const method = String(params.method ?? "POST").toUpperCase();
        const res = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: method === "GET" ? undefined : JSON.stringify(params.body ?? ctx.data),
        });
        return ok(action, label, `HTTP ${method} ${url} → ${res.status}`, { status: res.status });
      }

      case "ai_generate": {
        const prompt = String(params.prompt ?? "");
        if (!prompt) return fail(action, label, "Instrução (prompt) ausente");
        if (!ctx.apiKey) {
          return fail(action, label, "Chave da Anthropic não configurada — adicione em Configurações");
        }
        const client = new Anthropic({ apiKey: ctx.apiKey });
        const resp = await client.messages.create({
          model: process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-20240620",
          max_tokens: 600,
          messages: [{ role: "user", content: prompt }],
        });
        const out = resp.content
          .filter((b): b is Anthropic.TextBlock => b.type === "text")
          .map((b) => b.text)
          .join("");
        ctx.data.ai_output = out;
        return ok(action, label, "Texto gerado pela IA", { ai_output: out });
      }

      case "analyze_image": {
        const imageUrl = String(params.image_url ?? "");
        const prompt = String(params.prompt ?? "O que tem nesta imagem?");
        if (!imageUrl) return fail(action, label, "URL da imagem ausente");
        if (!isSafeUrl(imageUrl)) return fail(action, label, "URL da imagem não permitida (segurança)");
        if (!ctx.apiKey) return fail(action, label, "Chave da Anthropic não configurada");

        const imageRes = await fetch(imageUrl);
        if (!imageRes.ok) return fail(action, label, `Erro ao baixar imagem: ${imageRes.statusText}`);
        const buffer = await imageRes.arrayBuffer();
        const base64 = Buffer.from(buffer).toString("base64");
        const contentType = imageRes.headers.get("content-type") || "image/jpeg";

        const client = new Anthropic({ apiKey: ctx.apiKey });
        const resp = await client.messages.create({
          model: process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-20240620",
          max_tokens: 1000,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: contentType.includes("png") ? "image/png" : contentType.includes("gif") ? "image/gif" : contentType.includes("webp") ? "image/webp" : "image/jpeg",
                    data: base64,
                  },
                },
                { type: "text", text: prompt },
              ],
            },
          ],
        });
        const out = resp.content
          .filter((b): b is Anthropic.TextBlock => b.type === "text")
          .map((b) => b.text)
          .join("");
        ctx.data.image_analysis = out;
        return ok(action, label, "Imagem analisada pela IA", { image_analysis: out });
      }

      case "condition": {
        const prompt = String(params.prompt ?? "");
        if (!prompt) return fail(action, label, "Pergunta (prompt) ausente");
        if (!ctx.apiKey) return fail(action, label, "Chave da Anthropic não configurada");

        const client = new Anthropic({ apiKey: ctx.apiKey });
        const resp = await client.messages.create({
          model: process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-20240620",
          max_tokens: 50,
          messages: [
            {
              role: "user",
              content: `Responda apenas SIM ou NÃO (e uma breve justificativa opcional após) para a pergunta baseada nos dados fornecidos.\n\nDados: ${JSON.stringify(
                ctx.data
              )}\n\nPergunta: ${prompt}`,
            },
          ],
        });
        const out = resp.content
          .filter((b): b is Anthropic.TextBlock => b.type === "text")
          .map((b) => b.text)
          .join("");

        const result = out.toUpperCase().includes("SIM");
        return ok(action, label, `Condição avaliada como ${result ? "SIM" : "NÃO"}: ${out}`, {
          condition_result: result,
          reason: out,
        });
      }

      case "transform": {
        const instruction = String(params.instruction ?? "");
        if (!instruction) return fail(action, label, "Instrução de transformação ausente");
        if (!ctx.apiKey) return fail(action, label, "Chave da Anthropic não configurada");

        const client = new Anthropic({ apiKey: ctx.apiKey });
        const resp = await client.messages.create({
          model: process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-20240620",
          max_tokens: 1000,
          messages: [
            {
              role: "user",
              content: `Transforme os dados fornecidos seguindo exatamente esta instrução: ${instruction}\n\nRetorne APENAS o resultado final da transformação, sem explicações.\n\nDados: ${JSON.stringify(
                ctx.data
              )}`,
            },
          ],
        });
        const out = resp.content
          .filter((b): b is Anthropic.TextBlock => b.type === "text")
          .map((b) => b.text)
          .join("");

        ctx.data.transformed_output = out;
        return ok(action, label, "Dados transformados pela IA", { transformed_output: out });
      }

      default:
        return fail(action, label, `Ação desconhecida: ${action.type}`);
    }
  } catch (err) {
    return fail(action, label, err instanceof Error ? err.message : String(err));
  }
}

function ok(action: Action, label: string, detail: string, output?: unknown): ExecutionStep {
  return { action: action.type, label, status: "success", detail, output };
}

function fail(action: Action, label: string, detail: string): ExecutionStep {
  return { action: action.type, label, status: "error", detail };
}
