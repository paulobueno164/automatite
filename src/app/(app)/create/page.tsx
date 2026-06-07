import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function CreatePage() {
  if (!(await getCurrentUser())) redirect("/login");
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Nova automação</h1>
        <p className="text-sm text-slate-500">Escolha o caminho mais rápido pra você.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="/create/templates" className="card flex flex-col gap-2 transition hover:border-brand-300 hover:shadow">
          <span className="text-3xl">📦</span>
          <h2 className="text-lg font-semibold">Usar um template</h2>
          <p className="text-sm text-slate-500">
            Fluxos prontos para os casos mais comuns. Escolha, ajuste os dados e ative em segundos.
          </p>
          <span className="mt-2 text-sm font-medium text-brand-700">Ver templates →</span>
        </Link>

        <Link href="/create/ai" className="card flex flex-col gap-2 transition hover:border-brand-300 hover:shadow">
          <span className="text-3xl">🤖</span>
          <h2 className="text-lg font-semibold">Criar com IA</h2>
          <p className="text-sm text-slate-500">
            Descreva em linguagem natural o que você quer automatizar. A IA monta o fluxo completo pra você.
          </p>
          <span className="mt-2 text-sm font-medium text-brand-700">Descrever automação →</span>
        </Link>
      </div>
    </div>
  );
}
