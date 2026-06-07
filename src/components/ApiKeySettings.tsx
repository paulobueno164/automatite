"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type KeyRow = { id: string; name: string; keyPrefix: string; createdAt: string; lastUsedAt: string | null };

export function ApiKeySettings({ keys, appOrigin }: { keys: KeyRow[]; appOrigin: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setError(null);
    setNewKey(null);
    setBusy(true);
    try {
      const res = await fetch("/api/settings/api-key", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Falha");
      setNewKey(d.key);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    setBusy(true);
    await fetch(`/api/settings/api-key?id=${id}`, { method: "DELETE" });
    router.refresh();
    setBusy(false);
  }

  const base = `${appOrigin}/api/v1`;

  return (
    <div id="setting-api" className="card scroll-mt-24 space-y-4">
      <div>
        <h2 className="font-semibold">API do CRM</h2>
        <p className="text-sm text-slate-500">
          Exporte seus contatos para outro sistema. Use a chave no header{" "}
          <code className="rounded bg-slate-100 px-1">Authorization: Bearer atk_...</code>
        </p>
      </div>

      <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600 space-y-1">
        <p><strong>GET</strong> <code>{base}/leads</code> — lista contatos</p>
        <p><strong>GET</strong> <code>{base}/leads?status=new&limit=50</code> — filtrar</p>
        <p><strong>GET</strong> <code>{base}/leads/&#123;id&#125;</code> — detalhe + histórico</p>
      </div>

      {keys.length > 0 && (
        <ul className="space-y-2">
          {keys.map((k) => (
            <li key={k.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-2.5 text-sm">
              <div>
                <p className="font-medium">{k.name}</p>
                <p className="text-xs text-slate-400">
                  <code>{k.keyPrefix}</code> · criada {new Date(k.createdAt).toLocaleDateString("pt-BR")}
                  {k.lastUsedAt && ` · usada ${new Date(k.lastUsedAt).toLocaleDateString("pt-BR")}`}
                </p>
              </div>
              <button onClick={() => revoke(k.id)} disabled={busy} className="text-xs text-red-600 hover:underline">
                Revogar
              </button>
            </li>
          ))}
        </ul>
      )}

      {newKey && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm">
          <p className="font-medium text-green-800">Chave criada — copie agora:</p>
          <code className="mt-1 block break-all rounded bg-white p-2 text-xs">{newKey}</code>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button onClick={generate} disabled={busy} className="btn-primary">
        {busy ? "Gerando…" : "Gerar nova chave"}
      </button>
    </div>
  );
}
