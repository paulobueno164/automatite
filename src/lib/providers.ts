import { JWT } from "google-auth-library";
import { Credentials } from "./provider-catalog";
import { buildEmailContent } from "./email-template";
import { createSmtpTransporter } from "./smtp-verify";

type Params = Record<string, unknown>;

export type ProviderResult = { detail: string; output?: unknown };

const str = (v: unknown, fallback = "") => (v === undefined || v === null ? fallback : String(v));

/** Google Sheets — adiciona uma linha via API (autenticação por service account). */
export async function googleSheetsAppend(creds: Credentials, params: Params, data: Record<string, unknown>): Promise<ProviderResult> {
  const sa = JSON.parse(creds.serviceAccountJson);
  const spreadsheetId = str(params.spreadsheetId || creds.spreadsheetId);
  if (!spreadsheetId) throw new Error("spreadsheetId ausente (na ação ou na integração)");
  const sheet = str(params.sheet, "Sheet1");

  const client = new JWT({
    email: sa.client_email,
    key: sa.private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const { token } = await client.getAccessToken();

  // A linha: usa params.values se vier array; senão, os valores do payload.
  const row = Array.isArray(params.values) ? params.values : Object.values(data);

  const range = `${sheet}!A1`;
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ values: [row] }),
    }
  );
  if (!res.ok) throw new Error(`Google Sheets ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return { detail: `Linha adicionada em ${sheet} (${json.updates?.updatedRange ?? "ok"})`, output: json.updates };
}

/** WhatsApp Cloud API (Meta) — envia mensagem de texto. */
export async function whatsappSend(creds: Credentials, params: Params): Promise<ProviderResult> {
  const to = str(params.to);
  const text = str(params.text || params.body);
  if (!to) throw new Error("Destinatário (to) ausente");
  const res = await fetch(`https://graph.facebook.com/v21.0/${creds.phoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${creds.accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body: text } }),
  });
  if (!res.ok) throw new Error(`WhatsApp ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return { detail: `WhatsApp enviado para ${to} (id ${json.messages?.[0]?.id ?? "?"})`, output: json };
}

/** Twilio — envia SMS. */
export async function twilioSendSms(creds: Credentials, params: Params): Promise<ProviderResult> {
  const to = str(params.to);
  const text = str(params.text || params.body);
  if (!to) throw new Error("Destinatário (to) ausente");
  const body = new URLSearchParams({ From: creds.fromNumber, To: to, Body: text });
  const auth = Buffer.from(`${creds.accountSid}:${creds.authToken}`).toString("base64");
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${creds.accountSid}/Messages.json`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`Twilio ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return { detail: `SMS enviado para ${to} (sid ${json.sid})`, output: { sid: json.sid } };
}

/** Pipedrive — cria uma atividade (tarefa). */
export async function pipedriveCreateTask(creds: Credentials, params: Params): Promise<ProviderResult> {
  const subject = str(params.title || params.subject, "Nova tarefa");
  const res = await fetch(`https://api.pipedrive.com/v1/activities?api_token=${encodeURIComponent(creds.apiToken)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subject, type: "task" }),
  });
  if (!res.ok) throw new Error(`Pipedrive ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return { detail: `Atividade criada no Pipedrive: "${subject}" (id ${json.data?.id ?? "?"})`, output: { id: json.data?.id } };
}

/** Trello — cria um card numa lista. */
export async function trelloCreateCard(creds: Credentials, params: Params): Promise<ProviderResult> {
  const name = str(params.title || params.name, "Novo card");
  const idList = str(params.listId || creds.defaultListId);
  if (!idList) throw new Error("ID da lista ausente (na ação ou na integração)");
  const qs = new URLSearchParams({ key: creds.key, token: creds.token, idList, name });
  const res = await fetch(`https://api.trello.com/1/cards?${qs.toString()}`, { method: "POST" });
  if (!res.ok) throw new Error(`Trello ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return { detail: `Card criado no Trello: "${name}" (id ${json.id})`, output: { id: json.id } };
}

/** Asana — cria uma tarefa num projeto. */
export async function asanaCreateTask(creds: Credentials, params: Params): Promise<ProviderResult> {
  const name = str(params.title || params.name, "Nova tarefa");
  const projectId = str(params.projectId || creds.defaultProjectId);
  const data: Record<string, unknown> = { name };
  if (projectId) data.projects = [projectId];
  const res = await fetch("https://app.asana.com/api/1.0/tasks", {
    method: "POST",
    headers: { Authorization: `Bearer ${creds.accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ data }),
  });
  if (!res.ok) throw new Error(`Asana ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return { detail: `Tarefa criada no Asana: "${name}" (id ${json.data?.gid ?? "?"})`, output: { id: json.data?.gid } };
}

/** Envio de e-mail via SMTP do próprio usuário (Gmail, Outlook, Hostinger, etc.). */
export async function smtpSendEmail(creds: Credentials, params: Params): Promise<ProviderResult> {
  const to = str(params.to);
  const subject = str(params.subject, "(sem assunto)");
  const text = str(params.body);
  if (!to) throw new Error("Destinatário ausente");
  if (!creds.host || !creds.user || !creds.password) {
    throw new Error("SMTP incompleto — configure em Configurações → Seu e-mail");
  }

  const fromEmail = str(params.from) || str(creds.fromEmail) || creds.user;
  const fromName = str(creds.fromName);
  const from = fromName ? `${fromName} <${fromEmail}>` : fromEmail;

  const { html, text: plainText } = buildEmailContent(text, {
    templateHtml: creds.templateHtml,
    templateFooter: creds.templateFooter,
    templateAccentColor: creds.templateAccentColor,
    fromName,
    subject,
  });

  const transporter = createSmtpTransporter(creds);
  const info = await transporter.sendMail({ from, to, subject, text: plainText, html });
  transporter.close();
  return { detail: `E-mail enviado de ${fromEmail} para ${to}`, output: { messageId: info.messageId } };
}

/** Slack — envia mensagem para um canal. */
export async function slackSend(creds: Credentials, params: Params): Promise<ProviderResult> {
  const channel = str(params.channel || creds.defaultChannel);
  const text = str(params.text || params.body);
  if (!channel) throw new Error("Canal (channel) ausente");
  if (!text) throw new Error("Mensagem (text) ausente");

  const res = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${creds.botToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ channel, text }),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(`Slack error: ${json.error}`);
  return { detail: `Mensagem enviada para o Slack (${channel})`, output: json };
}
