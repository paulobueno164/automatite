import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { LeadStatusSelect } from "@/components/LeadStatusSelect";
import { EVENT_TYPE_LABEL, LEAD_STATUSES } from "@/lib/crm-constants";

export const dynamic = "force-dynamic";

export default async function LeadDetailPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const lead = await prisma.lead.findFirst({
    where: { id: params.id, userId: user.id },
    include: { events: { orderBy: { createdAt: "desc" } } },
  });
  if (!lead) notFound();

  const extra = JSON.parse(lead.dataJson || "{}") as Record<string, unknown>;

  return (
    <div className="space-y-6">
      <Link href="/crm" className="text-sm text-slate-500 hover:underline">
        ← Voltar ao CRM
      </Link>

      <div className="card space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{lead.name}</h1>
            <p className="text-sm text-slate-500">
              {[lead.email, lead.phone, lead.company].filter(Boolean).join(" · ")}
            </p>
          </div>
          <LeadStatusSelect leadId={lead.id} status={lead.status} />
        </div>

        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-400">Status</dt>
            <dd>{LEAD_STATUSES.find((s) => s.value === lead.status)?.label}</dd>
          </div>
          <div>
            <dt className="text-slate-400">Origem</dt>
            <dd>{lead.source ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-slate-400">Criado em</dt>
            <dd>{new Date(lead.createdAt).toLocaleString("pt-BR")}</dd>
          </div>
          <div>
            <dt className="text-slate-400">Última atualização</dt>
            <dd>{new Date(lead.updatedAt).toLocaleString("pt-BR")}</dd>
          </div>
        </dl>

        {Object.keys(extra).length > 0 && (
          <div>
            <p className="mb-2 text-xs font-medium text-slate-500">Dados do formulário</p>
            <dl className="grid gap-2 rounded-lg bg-slate-50 p-3 text-sm sm:grid-cols-2">
              {Object.entries(extra).map(([key, value]) => (
                <div key={key}>
                  <dt className="text-xs text-slate-400">{key.replace(/_/g, " ")}</dt>
                  <dd className="text-slate-700">{String(value ?? "—")}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </div>

      <div className="card">
        <h2 className="mb-4 font-semibold">Histórico</h2>
        {lead.events.length === 0 ? (
          <p className="text-sm text-slate-400">Nenhum evento registrado.</p>
        ) : (
          <ol className="relative space-y-4 border-l border-slate-200 pl-6">
            {lead.events.map((ev) => (
              <li key={ev.id} className="relative">
                <span className="absolute -left-[1.6rem] top-1 h-3 w-3 rounded-full border-2 border-white bg-brand-500" />
                <div className="rounded-lg bg-slate-50 p-3">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-medium text-slate-800">{ev.title}</span>
                    <span className="badge bg-white text-slate-500">{EVENT_TYPE_LABEL[ev.type] ?? ev.type}</span>
                    <span className="text-xs text-slate-400">{new Date(ev.createdAt).toLocaleString("pt-BR")}</span>
                  </div>
                  {ev.detail && <p className="mt-1 text-sm text-slate-600">{ev.detail}</p>}
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
