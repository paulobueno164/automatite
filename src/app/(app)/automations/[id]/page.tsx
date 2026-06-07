import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { Flow, ExecutionStep } from "@/lib/flow-types";
import { FlowPreview } from "@/components/FlowPreview";
import { AutomationActions } from "@/components/AutomationActions";
import { AutomationReadiness } from "@/components/AutomationReadiness";
import { getAutomationReadiness } from "@/lib/automation-readiness";
import { buildReadinessContext } from "@/lib/readiness-context";
import { loadMigratedActions } from "@/lib/migrate-actions";
import { getFormConfig } from "@/lib/form-config";

export const dynamic = "force-dynamic";

export default async function AutomationDetailPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const automation = await prisma.automation.findUnique({
    where: { id: params.id },
    include: { executions: { orderBy: { createdAt: "desc" }, take: 20 } },
  });

  if (!automation || automation.userId !== user.id) notFound();

  const flow: Flow = {
    name: automation.name,
    description: automation.description,
    category: automation.category,
    trigger: JSON.parse(automation.triggerJson),
    actions: await loadMigratedActions(automation.id, automation.actionsJson),
  };

  const isSchedule = flow.trigger.type === "schedule";
  const readinessCtx = await buildReadinessContext(user.id);
  const readiness = getAutomationReadiness(flow, readinessCtx, automation.id);

  const appOrigin = (process.env.APP_URL ?? "").replace(/\/$/, "") || (() => {
    const h = headers();
    const host = h.get("host");
    if (!host) return "http://localhost:3000";
    const proto = h.get("x-forwarded-proto") ?? "http";
    return `${proto}://${host}`;
  })();
  const webhookUrl = `${appOrigin}/api/trigger/${automation.id}`;
  const formUrl = `${appOrigin}/f/${automation.id}`;
  const formConfig = getFormConfig(flow);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/" className="text-sm text-slate-500 hover:underline">
          ← Todas as automações
        </Link>
        <div className="flex gap-2">
          {!isSchedule && (
            <Link href={`/automations/${automation.id}/form`} className="btn-ghost text-sm">
              📝 Personalizar formulário
            </Link>
          )}
          <Link href={`/automations/${automation.id}/edit`} className="btn-ghost text-sm">
            ✏️ Editar fluxo
          </Link>
        </div>
      </div>

      {isSchedule && (
        <div className="card flex flex-wrap gap-x-8 gap-y-2 text-sm">
          <div>
            <span className="text-slate-500">Agendamento: </span>
            <code className="rounded bg-slate-50 px-1">{String(flow.trigger.config?.cron ?? "—")}</code>
          </div>
          <div>
            <span className="text-slate-500">Próxima execução: </span>
            {automation.nextRunAt ? new Date(automation.nextRunAt).toLocaleString("pt-BR") : (automation.active ? "—" : "ative para agendar")}
          </div>
          {automation.lastRunAt && (
            <div>
              <span className="text-slate-500">Última: </span>
              {new Date(automation.lastRunAt).toLocaleString("pt-BR")}
            </div>
          )}
        </div>
      )}

      <AutomationReadiness readiness={readiness} />

      <div className="grid gap-6 md:grid-cols-2">
        <div className="card">
          <FlowPreview flow={flow} />
        </div>

        <div className="space-y-6">
          <AutomationActions
            id={automation.id}
            name={automation.name}
            description={automation.description}
            initialActive={automation.active}
            readiness={readiness}
            formUrl={formUrl}
            webhookUrl={webhookUrl}
            formConfig={formConfig}
            isSchedule={isSchedule}
          />
        </div>
      </div>

      <div className="card">
        <h2 className="mb-3 font-semibold">Histórico de execuções</h2>
        {automation.executions.length === 0 ? (
          <p className="text-sm text-slate-400">Nenhuma execução ainda. Use “Testar agora” acima.</p>
        ) : (
          <div className="space-y-2">
            {automation.executions.map((ex) => {
              const steps: ExecutionStep[] = JSON.parse(ex.logJson);
              return (
                <details key={ex.id} className="rounded-lg border border-slate-200 p-3">
                  <summary className="flex cursor-pointer items-center gap-2 text-sm">
                    <span className={`badge ${ex.status === "success" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                      {ex.status}
                    </span>
                    <span className="text-slate-500">{new Date(ex.createdAt).toLocaleString("pt-BR")}</span>
                    <span className="text-slate-400">· {steps.length} passos</span>
                  </summary>
                  <ol className="mt-2 space-y-1">
                    {steps.map((s, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-slate-600">
                        <span className={s.status === "success" ? "text-green-600" : "text-red-600"}>
                          {s.status === "success" ? "✓" : "✕"}
                        </span>
                        <span>
                          <strong>{s.label}</strong> — {s.detail}
                        </span>
                      </li>
                    ))}
                  </ol>
                </details>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
