import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { Flow } from "@/lib/flow-types";
import { FlowEditor } from "@/components/FlowEditor";
import { buildReadinessContext } from "@/lib/readiness-context";
import { loadMigratedActions } from "@/lib/migrate-actions";

export const dynamic = "force-dynamic";

export default async function EditAutomationPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const automation = await prisma.automation.findUnique({ where: { id: params.id } });
  if (!automation || automation.userId !== user.id) notFound();

  const flow: Flow = {
    name: automation.name,
    description: automation.description,
    category: automation.category,
    trigger: JSON.parse(automation.triggerJson),
    actions: await loadMigratedActions(automation.id, automation.actionsJson),
  };

  const readinessCtx = await buildReadinessContext(user.id);

  return (
    <div className="space-y-6">
      <Link href={`/automations/${automation.id}`} className="text-sm text-slate-500 hover:underline">
        ← Voltar para a automação
      </Link>
      <h1 className="text-2xl font-bold">Editar fluxo</h1>
      <FlowEditor id={automation.id} initialFlow={flow} readinessCtx={readinessCtx} />
    </div>
  );
}
