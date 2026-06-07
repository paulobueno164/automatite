import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { LEAD_STATUSES } from "@/lib/crm-constants";

export const dynamic = "force-dynamic";

const STATUS_BADGE: Record<string, string> = {
  new: "bg-blue-100 text-blue-700",
  contacted: "bg-amber-100 text-amber-800",
  qualified: "bg-purple-100 text-purple-700",
  won: "bg-green-100 text-green-700",
  lost: "bg-slate-100 text-slate-500",
};

export default async function CrmPage({ searchParams }: { searchParams: { status?: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const statusFilter = searchParams.status;
  const leads = await prisma.lead.findMany({
    where: { userId: user.id, ...(statusFilter ? { status: statusFilter } : {}) },
    orderBy: { updatedAt: "desc" },
    take: 100,
    include: { _count: { select: { events: true } } },
  });

  const counts = await prisma.lead.groupBy({ by: ["status"], where: { userId: user.id }, _count: true });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">CRM</h1>
          <p className="text-sm text-slate-500">Seus contatos e o histórico de tudo que aconteceu com cada um.</p>
        </div>
        <Link href="/settings#setting-api" className="btn-ghost text-sm">
          Exportar via API ↗
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          href="/crm"
          className={`badge ${!statusFilter ? "bg-brand-100 text-brand-700" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
        >
          Todos ({counts.reduce((s, c) => s + c._count, 0)})
        </Link>
        {LEAD_STATUSES.map((s) => {
          const n = counts.find((c) => c.status === s.value)?._count ?? 0;
          return (
            <Link
              key={s.value}
              href={`/crm?status=${s.value}`}
              className={`badge ${statusFilter === s.value ? "bg-brand-100 text-brand-700" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
            >
              {s.label} ({n})
            </Link>
          );
        })}
      </div>

      {leads.length === 0 ? (
        <div className="card text-center text-sm text-slate-400">
          Nenhum contato ainda. Use a ação <strong>Salvar no CRM</strong> numa automação para começar.
        </div>
      ) : (
        <div className="space-y-2">
          {leads.map((lead) => (
            <Link
              key={lead.id}
              href={`/crm/${lead.id}`}
              className="card flex items-center justify-between gap-3 transition hover:border-brand-200"
            >
              <div className="min-w-0">
                <p className="font-medium text-slate-800">{lead.name}</p>
                <p className="truncate text-xs text-slate-400">
                  {[lead.email, lead.phone, lead.company].filter(Boolean).join(" · ") || "Sem contato"}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2 text-xs text-slate-400">
                <span className={`badge ${STATUS_BADGE[lead.status] ?? "bg-slate-100"}`}>
                  {LEAD_STATUSES.find((s) => s.value === lead.status)?.label ?? lead.status}
                </span>
                <span>{lead._count.events} eventos</span>
                <span>{new Date(lead.updatedAt).toLocaleDateString("pt-BR")}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
