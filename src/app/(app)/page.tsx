import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const automations = await prisma.automation.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { executions: true } } },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold">Minhas automações</h1>
          <p className="text-sm text-slate-500">Crie, ative e acompanhe seus fluxos.</p>
        </div>
        <Link href="/create" className="btn-primary">
          + Nova automação
        </Link>
      </div>

      {automations.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 py-12 text-center">
          <span className="text-4xl">⚡</span>
          <h2 className="text-lg font-semibold">Nenhuma automação ainda</h2>
          <p className="max-w-md text-sm text-slate-500">
            Comece escolhendo um template pronto ou descreva o que você quer automatizar — a IA monta o fluxo
            pra você.
          </p>
          <Link href="/create" className="btn-primary mt-2">
            Criar minha primeira automação
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {automations.map((a) => (
            <Link key={a.id} href={`/automations/${a.id}`} className="card transition hover:border-brand-300 hover:shadow">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{a.name}</h3>
                <span className={`badge ${a.active ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                  {a.active ? "Ativa" : "Inativa"}
                </span>
              </div>
              <p className="mt-1 line-clamp-2 text-sm text-slate-500">{a.description}</p>
              <div className="mt-3 flex items-center gap-3 text-xs text-slate-400">
                <span className="badge bg-brand-50 text-brand-700">{a.category}</span>
                <span>{a._count.executions} execuções</span>
                <span>· criada via {a.source}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
