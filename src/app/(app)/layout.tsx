import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { LogoutButton } from "@/components/LogoutButton";
import { AiAssistant } from "@/components/AiAssistant";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  return (
    <>
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center gap-2 font-bold text-brand-700">
            <span className="text-xl">⚡</span> Automatite
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            {user ? (
              <>
                <Link href="/" className="text-slate-600 hover:text-slate-900">
                  Automações
                </Link>
                <Link href="/crm" className="text-slate-600 hover:text-slate-900">
                  CRM
                </Link>
                <Link href="/registros" className="text-slate-600 hover:text-slate-900">
                  Registros
                </Link>
                <Link href="/tarefas" className="text-slate-600 hover:text-slate-900">
                  Tarefas
                </Link>
                <Link href="/billing" className="text-slate-600 hover:text-slate-900">
                  Planos
                </Link>
                <Link href="/settings" className="text-slate-600 hover:text-slate-900">
                  Configurações
                </Link>
                <Link href="/create" className="btn-primary">
                  + Nova automação
                </Link>
                <span className="hidden text-slate-400 sm:inline">{user.email}</span>
                <LogoutButton />
              </>
            ) : (
              <>
                <Link href="/login" className="text-slate-600 hover:text-slate-900">
                  Entrar
                </Link>
                <Link href="/signup" className="btn-primary">
                  Criar conta
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
      <footer className="mx-auto max-w-5xl px-4 py-8 text-center text-xs text-slate-400">
        Automatite · MVP · Modelo híbrido (templates + IA)
      </footer>
      {user && <AiAssistant />}
    </>
  );
}
