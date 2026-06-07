"use client";

import { useMemo, useState } from "react";
import {
  DEFAULT_EMAIL_TEMPLATE,
  DEFAULT_TEMPLATE_ACCENT,
  DEFAULT_TEMPLATE_FOOTER,
  buildEmailPreviewHtml,
} from "@/lib/email-template";

export type EmailLayoutValues = {
  templateFooter: string;
  templateAccentColor: string;
  templateHtml: string;
};

export function EmailLayoutEditor({
  values,
  onChange,
  fromName,
  onSave,
  busy,
  isConnected,
  msg,
  error,
  errorHint,
}: {
  values: EmailLayoutValues;
  onChange: (values: EmailLayoutValues) => void;
  fromName: string;
  onSave: () => void;
  busy: boolean;
  isConnected: boolean;
  msg: string | null;
  error: string | null;
  errorHint: string | null;
}) {
  const [showHtml, setShowHtml] = useState(false);

  const previewHtml = useMemo(
    () =>
      buildEmailPreviewHtml({
        templateHtml: values.templateHtml || undefined,
        templateFooter: values.templateFooter,
        templateAccentColor: values.templateAccentColor,
        fromName,
        subject: "Bem-vindo!",
      }),
    [values, fromName]
  );

  function restoreDefault() {
    onChange({
      templateFooter: DEFAULT_TEMPLATE_FOOTER,
      templateAccentColor: DEFAULT_TEMPLATE_ACCENT,
      templateHtml: "",
    });
    setShowHtml(false);
  }

  return (
    <div id="setting-email-layout" className="space-y-4 rounded-lg border border-slate-200 bg-slate-50/50 p-4">
      <div>
        <h3 className="font-medium">Layout do e-mail</h3>
        <p className="text-sm text-slate-500">
          Visual que suas automações usam ao enviar e-mails. O texto de cada automação entra no meio do layout. Use{" "}
          <code className="rounded bg-white px-1 text-xs">{"{conteudo}"}</code> se editar o HTML.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium">Cor do cabeçalho</label>
          <div className="flex gap-2">
            <input
              type="color"
              className="h-10 w-14 cursor-pointer rounded border border-slate-200 bg-white"
              value={values.templateAccentColor || DEFAULT_TEMPLATE_ACCENT}
              onChange={(e) => onChange({ ...values, templateAccentColor: e.target.value })}
            />
            <input
              className="input flex-1 text-sm"
              value={values.templateAccentColor}
              onChange={(e) => onChange({ ...values, templateAccentColor: e.target.value })}
              placeholder="#6366f1"
            />
          </div>
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium">Texto do rodapé</label>
          <input
            className="input text-sm"
            value={values.templateFooter}
            onChange={(e) => onChange({ ...values, templateFooter: e.target.value })}
            placeholder={DEFAULT_TEMPLATE_FOOTER}
          />
        </div>
      </div>

      <div>
        <button type="button" onClick={() => setShowHtml(!showHtml)} className="text-sm text-brand-700 hover:underline">
          {showHtml ? "Ocultar editor HTML" : "Personalizar HTML (avançado)"}
        </button>
        {showHtml && (
          <div className="mt-2 space-y-2">
            <textarea
              className="input min-h-[200px] font-mono text-xs"
              value={values.templateHtml || DEFAULT_EMAIL_TEMPLATE}
              onChange={(e) => onChange({ ...values, templateHtml: e.target.value })}
            />
            <button type="button" onClick={restoreDefault} className="text-xs text-slate-500 hover:underline">
              Restaurar layout padrão
            </button>
          </div>
        )}
      </div>

      <div>
        <p className="mb-2 text-xs font-medium text-slate-600">Pré-visualização</p>
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <iframe title="Preview do e-mail" srcDoc={previewHtml} className="h-[320px] w-full border-0" sandbox="" />
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <p className="font-medium">{error}</p>
          {errorHint && <p className="mt-1 text-red-600">{errorHint}</p>}
        </div>
      )}
      {msg && <p className="text-sm text-green-600">{msg}</p>}

      <button onClick={onSave} disabled={busy || !isConnected} className="btn-ghost text-sm">
        {busy ? "Salvando…" : "Salvar layout"}
      </button>
    </div>
  );
}
