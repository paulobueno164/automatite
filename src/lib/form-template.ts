import { FormConfig, FormFieldDef } from "./form-config";

/** Classe que isola o CSS personalizado do formulário — nunca use body/html no HTML customizado. */
export const FORM_SCOPE_CLASS = "automatite-form-scope";

/** Layout HTML padrão — editável; campos reais são injetados em {campos}. */
export const DEFAULT_FORM_HTML = `<div style="max-width:480px;margin:0 auto;padding:32px;background:{fundo_card};border-radius:16px;box-shadow:0 4px 24px rgba(15,23,42,0.08);">
  <div style="text-align:center;margin-bottom:24px;">
    <h1 style="margin:0;font-size:22px;font-weight:700;color:#0f172a;">{titulo}</h1>
    <p style="margin:8px 0 0;font-size:14px;color:#64748b;">{descricao}</p>
  </div>
  {campos}
  <div style="margin-top:8px;">{erro}</div>
  <div style="margin-top:20px;">{botao}</div>
</div>`;

export const FORM_HTML_DOCS = {
  obrigatorio:
    "Use {campos} para injetar todos os campos de uma vez, OU posicione cada um com {campo:nome_do_campo} (ex: {campo:email}). Todos os campos configurados precisam aparecer.",
  opcionais: [
    "{titulo} — título do formulário",
    "{descricao} — texto abaixo do título",
    "{botao} — botão de enviar (se omitir, o botão aparece no final)",
    "{erro} — mensagens de validação",
    "{cor} — cor de destaque",
    "{fundo_card} — fundo do cartão",
  ],
  fixos:
    "Os inputs em si são gerados pelo sistema (name/id corretos para o CRM). Você controla o HTML ao redor — não remova {campos} ou {campo:*} senão os dados não chegam.",
  css:
    "Estilos em <style> ficam restritos ao formulário. Não use body, html ou :root — use classes próprias (ex: .meu-card). O sistema converte body/html automaticamente.",
};

/** Restringe CSS ao container do formulário para não quebrar o layout do site. */
export function scopeFormCss(css: string): string {
  const scope = `.${FORM_SCOPE_CLASS}`;
  return css.replace(/:root\b/g, scope).replace(/\bhtml\b/g, scope).replace(/\bbody\b/g, scope);
}

/** Remove tags perigosas do HTML personalizado. */
export function sanitizeFormHtml(html: string): string {
  // Remove scripts and dangerous tags
  let out = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
  out = out.replace(
    /<\/?(?:html|head|body|iframe|object|embed|applet|meta|link|base|form)\b[^>]*>/gi,
    ""
  );
  // Strip on* attributes (event handlers)
  out = out.replace(/\bon[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  // Neutralize javascript: URIs in href and src
  out = out.replace(
    /href\s*=\s*(?:"\s*javascript:[^"]*"|'\s*javascript:[^']*'|[^\s>]*javascript:[^\s>]*)/gi,
    'href="#"'
  );
  out = out.replace(
    /src\s*=\s*(?:"\s*javascript:[^"]*"|'\s*javascript:[^']*'|[^\s>]*javascript:[^\s>]*)/gi,
    'src="about:blank"'
  );
  return out.trim();
}

/** Extrai <style> do HTML e isola o CSS ao container do formulário. */
export function extractFormHtmlStyles(html: string): { html: string; css: string } {
  const cssParts: string[] = [];
  const without = html.replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gi, (_, css: string) => {
    cssParts.push(scopeFormCss(css));
    return "";
  });
  return { html: without.trim(), css: cssParts.join("\n") };
}

/** Valida se o HTML inclui todos os campos necessários. */
export function validateFormHtml(html: string, fields: FormFieldDef[]): { ok: true } | { ok: false; error: string } {
  const trimmed = html.trim();
  if (!trimmed) return { ok: true };

  if (trimmed.includes("{campos}")) return { ok: true };

  const missing = fields.filter((f) => !trimmed.includes(`{campo:${f.id}}`));
  if (missing.length === 0) return { ok: true };

  return {
    ok: false,
    error: `Inclua {campos} ou cada campo: ${missing.map((f) => `{campo:${f.id}}`).join(", ")}`,
  };
}

export type FormHtmlSegment =
  | { kind: "html"; content: string }
  | { kind: "campos" }
  | { kind: "campo"; fieldId: string }
  | { kind: "titulo" }
  | { kind: "descricao" }
  | { kind: "botao" }
  | { kind: "erro" };

const TOKEN_RE = /\{(campos|titulo|descricao|botao|erro|campo:(\w+)|cor|fundo_card)\}/g;

/** Divide o HTML nos trechos estáticos e slots dinâmicos. */
export function parseFormHtmlSegments(html: string): FormHtmlSegment[] {
  const segments: FormHtmlSegment[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  const re = new RegExp(TOKEN_RE.source, "g");
  while ((m = re.exec(html)) !== null) {
    if (m.index > last) {
      segments.push({ kind: "html", content: html.slice(last, m.index) });
    }
    const token = m[1];
    if (token === "campos") segments.push({ kind: "campos" });
    else if (token === "titulo") segments.push({ kind: "titulo" });
    else if (token === "descricao") segments.push({ kind: "descricao" });
    else if (token === "botao") segments.push({ kind: "botao" });
    else if (token === "erro") segments.push({ kind: "erro" });
    else if (token.startsWith("campo:")) segments.push({ kind: "campo", fieldId: m[2] });
    else if (token === "cor" || token === "fundo_card") {
      segments.push({ kind: "html", content: m[0] });
    }
    last = m.index + m[0].length;
  }
  if (last < html.length) segments.push({ kind: "html", content: html.slice(last) });
  return segments;
}

/** Substitui variáveis de estilo/texto no HTML estático. */
export function applyFormHtmlVars(html: string, vars: Record<string, string>): string {
  return html.replace(/\{(titulo|descricao|cor|fundo_card)\}/g, (_, key) => vars[key] ?? "");
}

export function resolveFormHtmlParts(config: FormConfig): { html: string; css: string } {
  const base = config.customHtml?.trim() || DEFAULT_FORM_HTML;
  const withVars = applyFormHtmlVars(base, {
    titulo: config.title,
    descricao: config.description,
    cor: config.style.accentColor,
    fundo_card: config.style.cardBackground,
  });
  if (!config.customHtml?.trim()) return { html: withVars, css: "" };
  const sanitized = sanitizeFormHtml(withVars);
  return extractFormHtmlStyles(sanitized);
}

export function resolveFormHtml(config: FormConfig): string {
  const { html, css } = resolveFormHtmlParts(config);
  return css ? `<style>${css}</style>${html}` : html;
}

/** Normaliza HTML antes de salvar (remove tags perigosas). */
export function prepareFormHtmlForSave(html: string): string {
  return sanitizeFormHtml(html.trim());
}

export function usesCustomHtml(config: FormConfig): boolean {
  return Boolean(config.customHtml?.trim());
}
