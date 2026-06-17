import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { Credentials } from "./provider-catalog";

export type SmtpVerifyResult =
  | { ok: true }
  | { ok: false; message: string; hint?: string };

export function createSmtpTransporter(creds: Credentials): Transporter {
  return nodemailer.createTransport({
    host: creds.host,
    port: Number(creds.port || 587),
    secure: creds.secure === "true",
    auth: { user: creds.user, pass: creds.password },
    connectionTimeout: 12_000,
    greetingTimeout: 12_000,
    socketTimeout: 12_000,
  });
}

function normalizeErrorText(err: unknown): string {
  const e = err as { code?: string; response?: string; responseCode?: number; message?: string };
  return [e.response, e.message, e.code, e.responseCode ? String(e.responseCode) : ""]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

/** Traduz erros do nodemailer para mensagens acionáveis em português. */
export function formatSmtpError(err: unknown, preset?: string): SmtpVerifyResult {
  const e = err as { code?: string; responseCode?: number };
  const text = normalizeErrorText(err);
  const isGmail = preset === "gmail" || text.includes("gmail");
  const isOutlook = preset === "outlook" || text.includes("outlook") || text.includes("office365");

  if (
    e.code === "EAUTH" ||
    e.responseCode === 535 ||
    e.responseCode === 534 ||
    text.includes("authentication") ||
    text.includes("username and password") ||
    text.includes("invalid login") ||
    text.includes("credentials")
  ) {
    if (isGmail) {
      return {
        ok: false,
        message: "Gmail recusou o login — e-mail ou senha incorretos.",
        hint: "Use uma senha de app de 16 caracteres (não a senha normal da conta). Ative a verificação em 2 etapas e gere a senha em myaccount.google.com → Segurança → Senhas de app.",
      };
    }
    if (isOutlook) {
      return {
        ok: false,
        message: "Outlook recusou o login — e-mail ou senha incorretos.",
        hint: "Confira se a conta tem verificação em 2 etapas e use a senha de app gerada em account.microsoft.com → Segurança.",
      };
    }
    return {
      ok: false,
      message: "E-mail ou senha incorretos.",
      hint: "Confira se copiou a senha de app completa, sem espaços extras.",
    };
  }

  if (e.code === "ECONNREFUSED" || text.includes("connection refused")) {
    return {
      ok: false,
      message: "Não foi possível conectar ao servidor SMTP.",
      hint: "Verifique o servidor (ex: smtp.gmail.com) e a porta. Para Gmail/Outlook use porta 587 com SSL desligado, ou 465 com SSL ligado.",
    };
  }

  if (e.code === "ETIMEDOUT" || e.code === "ESOCKET" || text.includes("timeout") || text.includes("timed out")) {
    return {
      ok: false,
      message: "Tempo esgotado ao conectar ao servidor de e-mail.",
      hint: "Confira servidor, porta e se o SSL está correto (587 = SSL não; 465 = SSL sim). Firewall ou rede podem bloquear a conexão.",
    };
  }

  if (text.includes("self signed") || text.includes("certificate") || e.code === "UNABLE_TO_VERIFY_LEAF_SIGNATURE") {
    return {
      ok: false,
      message: "Problema no certificado do servidor SMTP.",
      hint: "Confira se o servidor SMTP está correto. Para e-mail corporativo, use o host indicado pelo seu provedor de hospedagem.",
    };
  }

  if (text.includes("getaddrinfo") || text.includes("enotfound") || e.code === "EDNS") {
    return {
      ok: false,
      message: "Servidor SMTP não encontrado.",
      hint: "O endereço do servidor está errado ou incompleto. Escolha o provedor acima para preencher automaticamente.",
    };
  }

  return {
    ok: false,
    message: "Não foi possível validar o e-mail com essas configurações.",
    hint: "Revise servidor, porta, SSL, e-mail e senha de app.",
  };
}

/** Testa conexão e autenticação SMTP sem enviar e-mail. */
export async function verifySmtpCredentials(creds: Credentials, preset?: string): Promise<SmtpVerifyResult> {
  if (!creds.host?.trim() || !creds.user?.trim() || !creds.password?.trim()) {
    return { ok: false, message: "Preencha servidor, e-mail e senha.", hint: "A senha de app é obrigatória na primeira configuração." };
  }

  const transporter = createSmtpTransporter(creds);
  try {
    await transporter.verify();
    return { ok: true };
  } catch (err) {
    return formatSmtpError(err, preset);
  } finally {
    transporter.close();
  }
}
