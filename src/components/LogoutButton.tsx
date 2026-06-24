"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function logout() {
    setLoading(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch (err) {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={logout}
      disabled={loading}
      aria-label="Sair da conta"
      className="rounded text-slate-500 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
    >
      {loading ? "Saindo..." : "Sair"}
    </button>
  );
}
