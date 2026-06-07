"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  FormConfig,
  FormFieldDef,
  FormFieldType,
  DEFAULT_FORM_STYLE,
  DEFAULT_FORM_SUCCESS,
  uniqueFieldKey,
} from "@/lib/form-config";
import { DEFAULT_FORM_HTML, FORM_HTML_DOCS, validateFormHtml } from "@/lib/form-template";
import { PublicForm } from "./PublicForm";

const FIELD_TYPES: { value: FormFieldType; label: string }[] = [
  { value: "text", label: "Texto" },
  { value: "email", label: "E-mail" },
  { value: "tel", label: "Telefone" },
  { value: "textarea", label: "Texto longo" },
  { value: "number", label: "Número" },
  { value: "select", label: "Lista de opções" },
];

type Tab = "campos" | "visual" | "html" | "sucesso" | "preview";

export function FormBuilder({
  automationId,
  initial,
}: {
  automationId: string;
  initial: FormConfig;
}) {
  const router = useRouter();
  const [config, setConfig] = useState<FormConfig>(initial);
  const [tab, setTab] = useState<Tab>("campos");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  function setFields(fields: FormFieldDef[]) {
    setConfig((c) => ({ ...c, fields }));
  }

  function updateField(i: number, patch: Partial<FormFieldDef>) {
    setFields(config.fields.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
  }

  function addField() {
    const label = "Novo campo";
    const id = uniqueFieldKey(label, config.fields.map((f) => f.id));
    setFields([...config.fields, { id, label, type: "text", required: false, placeholder: "" }]);
  }

  function removeField(i: number) {
    setFields(config.fields.filter((_, idx) => idx !== i));
  }

  function moveField(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= config.fields.length) return;
    const copy = [...config.fields];
    [copy[i], copy[j]] = [copy[j], copy[i]];
    setFields(copy);
  }

  async function save() {
    setError(null);
    setMsg(null);
    if (config.fields.length === 0) {
      setError("Adicione ao menos um campo ao formulário.");
      return;
    }
    if (config.customHtml?.trim()) {
      const v = validateFormHtml(config.customHtml, config.fields);
      if (!v.ok) {
        setError(v.error);
        return;
      }
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/automations/${automationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formConfig: config }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Falha ao salvar");
      setMsg("Formulário salvo!");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro");
    } finally {
      setBusy(false);
    }
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "campos", label: "Campos" },
    { id: "visual", label: "Visual" },
    { id: "html", label: "HTML" },
    { id: "sucesso", label: "Após envio" },
    { id: "preview", label: "Prévia" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-lg border px-3 py-1.5 text-sm ${
              tab === t.id ? "border-brand-500 bg-brand-50 text-brand-800" : "border-slate-200 hover:bg-slate-50"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "campos" && (
        <div className="card space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium">Título do formulário</label>
              <input className="input text-sm" value={config.title} onChange={(e) => setConfig({ ...config, title: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium">Descrição (opcional)</label>
              <input
                className="input text-sm"
                value={config.description}
                onChange={(e) => setConfig({ ...config, description: e.target.value })}
                placeholder="Texto que aparece abaixo do título"
              />
            </div>
          </div>

          <p className="text-xs text-slate-500">
            Cada campo vira um dado no CRM e pode ser usado nas automações como <code>{"{nome_do_campo}"}</code>.
          </p>

          <div className="space-y-3">
            {config.fields.map((field, i) => (
              <div key={field.id} className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium text-slate-400">#{i + 1}</span>
                  <button type="button" onClick={() => moveField(i, -1)} className="btn-ghost px-2 py-0.5 text-xs" disabled={i === 0}>
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => moveField(i, 1)}
                    className="btn-ghost px-2 py-0.5 text-xs"
                    disabled={i === config.fields.length - 1}
                  >
                    ↓
                  </button>
                  <button type="button" onClick={() => removeField(i)} className="ml-auto text-xs text-red-600 hover:underline">
                    Remover
                  </button>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium">Rótulo</label>
                    <input
                      className="input text-sm"
                      value={field.label}
                      onChange={(e) => updateField(i, { label: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium">Identificador</label>
                    <input
                      className="input font-mono text-sm"
                      value={field.id}
                      onChange={(e) => updateField(i, { id: e.target.value.replace(/\s/g, "_").toLowerCase() })}
                    />
                    <p className="mt-0.5 text-[10px] text-slate-400">Placeholder: {"{" + field.id + "}"}</p>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium">Tipo</label>
                    <select
                      className="input text-sm"
                      value={field.type}
                      onChange={(e) => updateField(i, { type: e.target.value as FormFieldType })}
                    >
                      {FIELD_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-end gap-2 pb-1">
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={field.required} onChange={(e) => updateField(i, { required: e.target.checked })} />
                      Obrigatório
                    </label>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-xs font-medium">Placeholder</label>
                    <input
                      className="input text-sm"
                      value={field.placeholder ?? ""}
                      onChange={(e) => updateField(i, { placeholder: e.target.value })}
                    />
                  </div>
                  {field.type === "select" && (
                    <div className="sm:col-span-2">
                      <label className="mb-1 block text-xs font-medium">Opções (uma por linha)</label>
                      <textarea
                        className="input min-h-[80px] text-sm"
                        value={(field.options ?? []).join("\n")}
                        onChange={(e) =>
                          updateField(i, {
                            options: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean),
                          })
                        }
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <button type="button" onClick={addField} className="btn-ghost text-sm">
            + Adicionar campo
          </button>
        </div>
      )}

      {tab === "visual" && (
        <div className="card space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium">Cor de fundo da página</label>
              <div className="flex gap-2">
                <input
                  type="color"
                  className="h-10 w-14 rounded border"
                  value={config.style.backgroundColor}
                  onChange={(e) => setConfig({ ...config, style: { ...config.style, backgroundColor: e.target.value } })}
                />
                <input
                  className="input flex-1 text-sm"
                  value={config.style.backgroundColor}
                  onChange={(e) => setConfig({ ...config, style: { ...config.style, backgroundColor: e.target.value } })}
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Cor do botão / destaque</label>
              <div className="flex gap-2">
                <input
                  type="color"
                  className="h-10 w-14 rounded border"
                  value={config.style.accentColor}
                  onChange={(e) => setConfig({ ...config, style: { ...config.style, accentColor: e.target.value } })}
                />
                <input
                  className="input flex-1 text-sm"
                  value={config.style.accentColor}
                  onChange={(e) => setConfig({ ...config, style: { ...config.style, accentColor: e.target.value } })}
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Fundo do cartão</label>
              <div className="flex gap-2">
                <input
                  type="color"
                  className="h-10 w-14 rounded border"
                  value={config.style.cardBackground}
                  onChange={(e) => setConfig({ ...config, style: { ...config.style, cardBackground: e.target.value } })}
                />
                <input
                  className="input flex-1 text-sm"
                  value={config.style.cardBackground}
                  onChange={(e) => setConfig({ ...config, style: { ...config.style, cardBackground: e.target.value } })}
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Texto do botão</label>
              <input
                className="input text-sm"
                value={config.style.buttonLabel}
                onChange={(e) => setConfig({ ...config, style: { ...config.style, buttonLabel: e.target.value } })}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium">Imagem de fundo (URL, opcional)</label>
              <input
                className="input text-sm"
                placeholder="https://exemplo.com/fundo.jpg"
                value={config.style.backgroundImageUrl ?? ""}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    style: { ...config.style, backgroundImageUrl: e.target.value.trim() || undefined },
                  })
                }
              />
            </div>
          </div>
          <button
            type="button"
            onClick={() => setConfig({ ...config, style: { ...DEFAULT_FORM_STYLE } })}
            className="text-xs text-slate-500 hover:underline"
          >
            Restaurar visual padrão
          </button>
        </div>
      )}

      {tab === "html" && (
        <div className="card space-y-4">
          <div className="rounded-lg border border-amber-100 bg-amber-50/60 p-3 text-sm text-amber-900">
            <p className="font-medium">O que você pode personalizar</p>
            <p className="mt-1 text-amber-800/90">{FORM_HTML_DOCS.obrigatorio}</p>
            <p className="mt-2 text-xs text-amber-700">{FORM_HTML_DOCS.fixos}</p>
            <p className="mt-1 text-xs text-amber-700">{FORM_HTML_DOCS.css}</p>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium text-slate-600">Placeholders disponíveis</p>
            <ul className="list-disc space-y-1 pl-4 text-xs text-slate-500">
              <li>
                <code>{"{campos}"}</code> — todos os campos de uma vez
              </li>
              {config.fields.map((f) => (
                <li key={f.id}>
                  <code>{`{campo:${f.id}}`}</code> — só o campo {f.label}
                </li>
              ))}
              {FORM_HTML_DOCS.opcionais.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium">HTML do formulário</label>
            <textarea
              className="input min-h-[280px] font-mono text-xs"
              value={config.customHtml ?? ""}
              placeholder="Deixe vazio para usar o layout padrão. Cole seu HTML com {campos} ou {campo:id}."
              onChange={(e) => setConfig({ ...config, customHtml: e.target.value || undefined })}
            />
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setConfig({ ...config, customHtml: DEFAULT_FORM_HTML })}
              className="text-xs text-brand-700 hover:underline"
            >
              Usar template padrão
            </button>
            <button
              type="button"
              onClick={() => setConfig({ ...config, customHtml: undefined })}
              className="text-xs text-slate-500 hover:underline"
            >
              Remover HTML personalizado
            </button>
          </div>
        </div>
      )}

      {tab === "sucesso" && (
        <div className="card space-y-4">
          <p className="text-sm text-slate-500">Tela exibida após o visitante enviar o formulário. Use {"{nome}"}, {"{email}"} etc. para personalizar.</p>
          <div>
            <label className="mb-1 block text-xs font-medium">Título</label>
            <input
              className="input text-sm"
              value={config.success.title}
              onChange={(e) => setConfig({ ...config, success: { ...config.success, title: e.target.value } })}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Mensagem</label>
            <textarea
              className="input min-h-[120px] text-sm"
              value={config.success.message}
              onChange={(e) => setConfig({ ...config, success: { ...config.success, message: e.target.value } })}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={config.success.showAnotherButton}
              onChange={(e) => setConfig({ ...config, success: { ...config.success, showAnotherButton: e.target.checked } })}
            />
            Mostrar botão para enviar outra resposta
          </label>
          {config.success.showAnotherButton && (
            <div>
              <label className="mb-1 block text-xs font-medium">Texto do botão</label>
              <input
                className="input text-sm"
                value={config.success.anotherButtonLabel}
                onChange={(e) => setConfig({ ...config, success: { ...config.success, anotherButtonLabel: e.target.value } })}
              />
            </div>
          )}
          <button
            type="button"
            onClick={() => setConfig({ ...config, success: { ...DEFAULT_FORM_SUCCESS } })}
            className="text-xs text-slate-500 hover:underline"
          >
            Restaurar mensagem padrão
          </button>
        </div>
      )}

      {tab === "preview" && (
        <div className="overflow-hidden rounded-xl border border-slate-200">
          <PublicForm automationId={automationId} config={config} showTitle />
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      {msg && <p className="text-sm text-green-600">{msg}</p>}

      <div className="flex gap-2">
        <button onClick={save} disabled={busy} className="btn-primary">
          {busy ? "Salvando…" : "Salvar formulário"}
        </button>
      </div>
    </div>
  );
}
