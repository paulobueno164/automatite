"use client";

import { useState } from "react";
import { useDeepLinkScroll } from "./useDeepLinkScroll";

export function PasswordSettings() {
  useDeepLinkScroll();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    setMsg(null);

    if (!currentPassword.trim()) {
      setError("Informe sua senha atual.");
      return;
    }
    if (newPassword.length < 6) {
      setError("A nova senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("A confirmação da nova senha não confere.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/settings/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Falha ao alterar senha");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setMsg("Senha alterada com sucesso!");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div id="setting-password" className="card scroll-mt-24 space-y-4">
      <div>
        <h2 className="font-semibold">Senha da conta</h2>
        <p className="text-sm text-slate-500">
          Altere a senha que você usa para entrar no Automatite. Por segurança, só você pode fazer isso aqui —
          o assistente de IA não altera senha de conta.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="currentPassword" className="mb-1 block text-sm font-medium">
            Senha atual
          </label>
          <input
            id="currentPassword"
            type="password"
            className="input text-sm"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="newPassword" className="mb-1 block text-sm font-medium">
            Nova senha
          </label>
          <input
            id="newPassword"
            type="password"
            className="input text-sm"
            autoComplete="new-password"
            placeholder="Mínimo 6 caracteres"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="confirmPassword" className="mb-1 block text-sm font-medium">
            Confirmar nova senha
          </label>
          <input
            id="confirmPassword"
            type="password"
            className="input text-sm"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {msg && <p className="text-sm text-green-600">{msg}</p>}

      <button onClick={save} disabled={busy} className="btn-primary">
        {busy ? "Salvando…" : "Alterar senha"}
      </button>
    </div>
  );
}
