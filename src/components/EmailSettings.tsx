"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SMTP_PRESETS, getSmtpPreset } from "@/lib/smtp-guides";
import { DEFAULT_TEMPLATE_ACCENT, DEFAULT_TEMPLATE_FOOTER } from "@/lib/email-template";
import { useDeepLinkScroll } from "./useDeepLinkScroll";
import { EmailLayoutEditor, EmailLayoutValues } from "./EmailLayoutEditor";

type SmtpInitial = {
  preset?: string;
  host?: string;
  port?: string;
  secure?: string;
  user?: string;
  fromEmail?: string;
  fromName?: string;
  templateFooter?: string;
  templateAccentColor?: string;
  templateHtml?: string;
};

export function EmailSettings({
  isConnected,
  fromHint,
  initial,
}: {
  isConnected: boolean;
  fromHint: string | null;
  initial?: SmtpInitial;
}) {
  const router = useRouter();
  useDeepLinkScroll();
  const [presetId, setPresetId] = useState(initial?.preset ?? "gmail");
  const [showTutorial, setShowTutorial] = useState(true);
  const [values, setValues] = useState({
    host: initial?.host ?? "smtp.gmail.com",
    port: initial?.port ?? "587",
    secure: initial?.secure ?? "false",
    user: initial?.user ?? "",
    password: "",
    fromEmail: initial?.fromEmail ?? "",
    fromName: initial?.fromName ?? "",
  });
  const [layout, setLayout] = useState<EmailLayoutValues>({
    templateFooter: initial?.templateFooter ?? DEFAULT_TEMPLATE_FOOTER,
    templateAccentColor: initial?.templateAccentColor ?? DEFAULT_TEMPLATE_ACCENT,
    templateHtml: initial?.templateHtml ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [layoutBusy, setLayoutBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorHint, setErrorHint] = useState<string | null>(null);
  const [layoutError, setLayoutError] = useState<string | null>(null);
  const [layoutErrorHint, setLayoutErrorHint] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [layoutMsg, setLayoutMsg] = useState<string | null>(null);

  const preset = getSmtpPreset(presetId) ?? SMTP_PRESETS[0];

  function selectPreset(id: string) {
    setPresetId(id);
    const p = getSmtpPreset(id);
    if (p && p.host) {
      setValues((v) => ({ ...v, host: p.host, port: p.port, secure: p.secure }));
    }
    setShowTutorial(true);
  }

  async function postSmtp(data: Record<string, string>, testConnection: boolean) {
    const res = await fetch("/api/integrations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "smtp", data, testConnection }),
    });
    const d = await res.json();
    if (!res.ok) return { ok: false as const, error: d.error, hint: d.hint };
    return { ok: true as const };
  }

  async function save() {
    setError(null);
    setErrorHint(null);
    setMsg(null);
    if (!values.host.trim() || !values.user.trim() || !values.fromEmail.trim()) {
      setError("Preencha servidor, e-mail e remetente.");
      return;
    }
    if (!isConnected && !values.password.trim()) {
      setError("Cole a senha ou senha de app do seu e-mail.");
      return;
    }
    setBusy(true);
    try {
      const result = await postSmtp({ ...values, ...layout, preset: presetId }, true);
      if (!result.ok) {
        setError(result.error ?? "Falha ao validar o e-mail");
        if (result.hint) setErrorHint(result.hint);
        return;
      }
      setValues((v) => ({ ...v, password: "" }));
      setMsg("Conexão testada com sucesso! Suas automações vão enviar com este endereço.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro");
    } finally {
      setBusy(false);
    }
  }

  async function saveLayout() {
    setLayoutError(null);
    setLayoutErrorHint(null);
    setLayoutMsg(null);
    if (!isConnected) {
      setLayoutError("Configure o SMTP acima antes de salvar o layout.");
      return;
    }
    setLayoutBusy(true);
    try {
      const result = await postSmtp({ ...values, ...layout, preset: presetId }, false);
      if (!result.ok) {
        setLayoutError(result.error ?? "Falha ao salvar");
        if (result.hint) setLayoutErrorHint(result.hint);
        return;
      }
      setLayoutMsg("Layout do e-mail salvo!");
      router.refresh();
    } catch (err) {
      setLayoutError(err instanceof Error ? err.message : "Erro");
    } finally {
      setLayoutBusy(false);
    }
  }

  async function disconnect() {
    setBusy(true);
    try {
      await fetch("/api/integrations?provider=smtp", { method: "DELETE" });
      setMsg("Configuração de e-mail removida.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div id="setting-email" className="card scroll-mt-24 space-y-4">
      <div>
        <h2 className="font-semibold">Seu e-mail</h2>
        <p className="text-sm text-slate-500">
          Para enviar e-mails com <strong>seu endereço</strong> (ex: voce@gmail.com ou contato@empresa.com), configure o
          SMTP uma vez aqui. Suas automações usam essa conta automaticamente.
        </p>
      </div>

      {isConnected && fromHint && (
        <div className="flex items-center justify-between rounded-lg bg-green-50 p-3 text-sm">
          <span className="text-green-700">
            E-mail configurado: <code>{fromHint}</code>
          </span>
          <button onClick={disconnect} disabled={busy} className="text-red-600 hover:underline">
            Remover
          </button>
        </div>
      )}

      <div>
        <label className="mb-2 block text-sm font-medium">De onde é seu e-mail?</label>
        <div className="flex flex-wrap gap-2">
          {SMTP_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => selectPreset(p.id)}
              className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                presetId === p.id ? "border-brand-500 bg-brand-50 text-brand-800" : "border-slate-200 hover:bg-slate-50"
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-brand-100 bg-brand-50/50">
        <button
          type="button"
          onClick={() => setShowTutorial(!showTutorial)}
          className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-brand-800"
        >
          <span>📖 Como configurar o {preset.name}</span>
          <span className="text-slate-400">{showTutorial ? "▲" : "▼"}</span>
        </button>
        {showTutorial && (
          <div className="space-y-3 border-t border-brand-100 px-4 py-3 text-sm text-slate-700">
            <ol className="list-decimal space-y-2 pl-4">
              {preset.steps.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
            {preset.tips.length > 0 && (
              <div className="rounded-md bg-white p-3 text-xs text-slate-500">
                <p className="mb-1 font-medium text-slate-600">Dicas</p>
                <ul className="list-disc space-y-1 pl-4">
                  {preset.tips.map((tip, i) => (
                    <li key={i}>{tip}</li>
                  ))}
                </ul>
              </div>
            )}
            {preset.docsUrl && (
              <a href={preset.docsUrl} target="_blank" rel="noreferrer" className="inline-block text-xs text-brand-700 hover:underline">
                Ver tutorial oficial do {preset.name} ↗
              </a>
            )}
          </div>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium">Servidor SMTP</label>
          <input
            className="input text-sm"
            placeholder="smtp.gmail.com"
            value={values.host}
            onChange={(e) => setValues({ ...values, host: e.target.value })}
          />
          <p className="mt-1 text-xs text-slate-400">Preenchido automaticamente ao escolher o provedor acima</p>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">Porta</label>
          <input className="input text-sm" value={values.port} onChange={(e) => setValues({ ...values, port: e.target.value })} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">SSL</label>
          <select className="input text-sm" value={values.secure} onChange={(e) => setValues({ ...values, secure: e.target.value })}>
            <option value="false">Não — porta 587 (mais comum)</option>
            <option value="true">Sim — porta 465</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">Seu e-mail</label>
          <input
            type="email"
            className="input text-sm"
            placeholder="voce@gmail.com"
            value={values.user}
            onChange={(e) => setValues({ ...values, user: e.target.value, fromEmail: values.fromEmail || e.target.value })}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">Senha ou senha de app</label>
          <input
            type="password"
            className="input text-sm"
            placeholder={isConnected ? "Deixe vazio para manter a atual" : "Cole a senha de app aqui"}
            value={values.password}
            onChange={(e) => setValues({ ...values, password: e.target.value })}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">Remetente (aparece para quem recebe)</label>
          <input
            type="email"
            className="input text-sm"
            placeholder="voce@gmail.com"
            value={values.fromEmail}
            onChange={(e) => setValues({ ...values, fromEmail: e.target.value })}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">Nome do remetente (opcional)</label>
          <input
            className="input text-sm"
            placeholder="Minha Empresa"
            value={values.fromName}
            onChange={(e) => setValues({ ...values, fromName: e.target.value })}
          />
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <p className="font-medium">{error}</p>
          {errorHint && <p className="mt-1 text-red-600">{errorHint}</p>}
        </div>
      )}
      {msg && <p className="text-sm text-green-600">{msg}</p>}

      <button onClick={save} disabled={busy} className="btn-primary">
        {busy ? "Testando conexão…" : isConnected ? "Atualizar e-mail" : "Salvar e-mail"}
      </button>

      <EmailLayoutEditor
        values={layout}
        onChange={setLayout}
        fromName={values.fromName || values.fromEmail || "Sua empresa"}
        onSave={saveLayout}
        busy={layoutBusy}
        isConnected={isConnected}
        msg={layoutMsg}
        error={layoutError}
        errorHint={layoutErrorHint}
      />
    </div>
  );
}
