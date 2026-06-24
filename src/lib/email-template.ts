/** Layout HTML padrão dos e-mails — editável em Configurações → Seu e-mail. */
export const DEFAULT_EMAIL_TEMPLATE = `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(15,23,42,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,{cor} 0%,#4f46e5 100%);padding:28px 32px;">
            <p style="margin:0;font-size:13px;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;color:rgba(255,255,255,0.85);">{marca}</p>
            <h1 style="margin:8px 0 0;font-size:22px;font-weight:700;color:#ffffff;line-height:1.3;">{titulo}</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;color:#334155;font-size:16px;line-height:1.65;">
            {conteudo}
          </td>
        </tr>
        <tr>
          <td style="padding:20px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;">
            <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.5;">{rodape}</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

export const DEFAULT_TEMPLATE_FOOTER = "Você recebeu este e-mail porque entrou em contato conosco.";
export const DEFAULT_TEMPLATE_ACCENT = "#6366f1";

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Converte texto plano em parágrafos HTML. */
export function textToHtmlParagraphs(text: string): string {
  return text
    .split(/\n+/)
    .filter((line) => line.trim())
    .map((line) => `<p style="margin:0 0 16px;">${escapeHtml(line.trim())}</p>`)
    .join("");
}

/** Substitui placeholders {chave} no template. */
export function applyTemplateVars(template: string, vars: Record<string, string>): string {
  return template.replace(/\{([\w]+)\}/g, (_, key) => vars[key] ?? "");
}

export type EmailLayoutOptions = {
  templateHtml?: string;
  templateFooter?: string;
  templateAccentColor?: string;
  fromName?: string;
  subject?: string;
};

/** Monta HTML final do e-mail com layout + conteúdo. */
export function buildEmailContent(
  bodyText: string,
  layout: EmailLayoutOptions
): { html: string; text: string } {
  const text = bodyText.trim();
  const conteudo = textToHtmlParagraphs(text);
  const template = layout.templateHtml?.trim() || DEFAULT_EMAIL_TEMPLATE;
  const html = applyTemplateVars(template, {
    marca: layout.fromName?.trim() || "Sua empresa",
    titulo: layout.subject?.trim() || "Olá!",
    conteudo,
    rodape: layout.templateFooter?.trim() || DEFAULT_TEMPLATE_FOOTER,
    cor: layout.templateAccentColor?.trim() || DEFAULT_TEMPLATE_ACCENT,
  });
  return { html, text };
}

/** Preview com dados de exemplo para a UI. */
export function buildEmailPreviewHtml(layout: EmailLayoutOptions): string {
  return buildEmailContent(
    "Olá Maria,\n\nObrigado pelo seu interesse! Em breve nossa equipe entrará em contato.\n\nAtenciosamente,\nEquipe",
    { ...layout, subject: layout.subject || "Bem-vindo!" }
  ).html;
}
