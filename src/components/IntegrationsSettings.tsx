"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useDeepLinkScroll } from "./useDeepLinkScroll";
import { PROVIDERS, ProviderDef } from "@/lib/provider-catalog";
import { EXTERNAL_PROVIDER_IDS } from "@/lib/platform-services";
import { PlatformServicesPanel } from "./PlatformServicesPanel";

const EXTERNAL_PROVIDERS = PROVIDERS.filter((p) => EXTERNAL_PROVIDER_IDS.includes(p.id as (typeof EXTERNAL_PROVIDER_IDS)[number]));

export function IntegrationsSettings({ connected, smsReady }: { connected: string[]; smsReady: boolean }) {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(null);
  useDeepLinkScroll(150);

  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (hash.startsWith("integration-")) {
      setOpenId(hash.replace("integration-", ""));
    }
  }, []);

  return (
    <div className="space-y-8">
      <PlatformServicesPanel smsReady={smsReady} />

      <div className="space-y-3">
        <div>
          <h2 className="font-semibold">Ferramentas externas (opcional)</h2>
          <p className="text-sm text-slate-500">
            Só conecte se você já usa essas ferramentas e quer sincronizar com elas. Para a maioria dos casos, os recursos
            inclusos acima são suficientes.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {EXTERNAL_PROVIDERS.map((p) => (
            <ProviderCard
              key={p.id}
              provider={p}
              isConnected={connected.includes(p.id)}
              isOpen={openId === p.id}
              onToggle={() => setOpenId(openId === p.id ? null : p.id)}
              onChanged={() => router.refresh()}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function ProviderCard({
  provider,
  isConnected,
  isOpen,
  onToggle,
  onChanged,
}: {
  provider: ProviderDef;
  isConnected: boolean;
  isOpen: boolean;
  onToggle: () => void;
  onChanged: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function connect() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: provider.id, data: values }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Falha");
      setValues({});
      onToggle();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro");
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    setBusy(true);
    try {
      await fetch(`/api/integrations?provider=${provider.id}`, { method: "DELETE" });
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div id={`integration-${provider.id}`} className="card scroll-mt-24">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">{provider.emoji}</span>
          <span className="font-medium">{provider.name}</span>
          {isConnected && <span className="badge bg-green-100 text-green-700">Conectado</span>}
        </div>
        <div className="flex gap-2 text-sm">
          {isConnected && (
            <button onClick={disconnect} disabled={busy} className="text-red-600 hover:underline">
              Remover
            </button>
          )}
          <button onClick={onToggle} className="font-medium text-brand-700 hover:underline">
            {isOpen ? "Fechar" : isConnected ? "Editar" : "Conectar"}
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="mt-3 space-y-3 border-t border-slate-100 pt-3">
          {provider.fields.map((f) => (
            <div key={f.key}>
              <label className="mb-1 block text-xs font-medium">
                {f.label} {f.optional && <span className="text-slate-400">(opcional)</span>}
              </label>
              {f.type === "textarea" ? (
                <textarea
                  className="input min-h-[90px] font-mono text-xs"
                  placeholder={f.placeholder}
                  value={values[f.key] ?? ""}
                  onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                />
              ) : (
                <input
                  type={f.type === "password" ? "password" : "text"}
                  className="input text-sm"
                  placeholder={f.placeholder}
                  value={values[f.key] ?? ""}
                  onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                />
              )}
              {f.hint && <p className="mt-1 text-xs text-slate-400">{f.hint}</p>}
            </div>
          ))}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex items-center justify-between">
            <button onClick={connect} disabled={busy} className="btn-primary">
              {busy ? "Salvando…" : "Salvar conexão"}
            </button>
            {provider.docs && (
              <a href={provider.docs} target="_blank" rel="noreferrer" className="text-xs text-slate-400 hover:underline">
                Documentação ↗
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
