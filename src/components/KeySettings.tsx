"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useDeepLinkScroll } from "./useDeepLinkScroll";

export function KeySettings({ hasKey, keyHint }: { hasKey: boolean; keyHint: string | null }) {
  const router = useRouter();
  useDeepLinkScroll();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    setMsg(null);
    setBusy(true);
    try {
      const res = await fetch("/api/settings/key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ anthropicKey: value }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Falha");
      setValue("");
      setMsg("Chave salva. Suas gerações por IA usarão essa chave.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      await fetch("/api/settings/key", { method: "DELETE" });
      setMsg("Chave removida. Voltamos a usar a chave da plataforma.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div id="setting-anthropic" className="card scroll-mt-24 space-y-4">
      <div>
        <h2 className="font-semibold">Chave da Anthropic (opcional)</h2>
        <p className="text-sm text-slate-500">
          Por padrão, suas automações usam a chave da plataforma. Se quiser usar e pagar pela sua própria
          conta da Anthropic, cole a chave aqui — ela tem prioridade.
        </p>
      </div>

      {hasKey && (
        <div className="flex items-center justify-between rounded-lg bg-green-50 p-3 text-sm">
          <span className="text-green-700">
            Chave própria configurada: <code>{keyHint}</code>
          </span>
          <button onClick={remove} disabled={busy} className="text-red-600 hover:underline">
            Remover
          </button>
        </div>
      )}

      <div>
        <label className="mb-1 block text-sm font-medium">{hasKey ? "Substituir chave" : "Adicionar chave"}</label>
        <input
          type="password"
          className="input font-mono"
          placeholder="sk-ant-api03-…"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {msg && <p className="text-sm text-green-600">{msg}</p>}

      <button onClick={save} disabled={busy || !value.trim()} className="btn-primary">
        {busy ? "Salvando…" : "Salvar chave"}
      </button>
    </div>
  );
}
