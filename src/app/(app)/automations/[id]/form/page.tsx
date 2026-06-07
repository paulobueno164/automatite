import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { Flow } from "@/lib/flow-types";
import { getFormConfig } from "@/lib/form-config";
import { FormBuilder } from "@/components/FormBuilder";

export const dynamic = "force-dynamic";

export default async function AutomationFormEditorPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const automation = await prisma.automation.findUnique({ where: { id: params.id } });
  if (!automation || automation.userId !== user.id) notFound();

  const flow: Flow = {
    name: automation.name,
    description: automation.description,
    category: automation.category,
    trigger: JSON.parse(automation.triggerJson),
    actions: JSON.parse(automation.actionsJson),
  };

  if (flow.trigger.type === "schedule") {
    return (
      <div className="space-y-4">
        <Link href={`/automations/${automation.id}`} className="text-sm text-slate-500 hover:underline">
          ← Voltar
        </Link>
        <p className="text-sm text-slate-600">Automações agendadas não usam formulário público.</p>
      </div>
    );
  }

  const formConfig = getFormConfig(flow);

  return (
    <div className="space-y-6">
      <Link href={`/automations/${automation.id}`} className="text-sm text-slate-500 hover:underline">
        ← Voltar para a automação
      </Link>
      <div>
        <h1 className="text-2xl font-bold">Personalizar formulário</h1>
        <p className="text-sm text-slate-500">
          Edite campos, cores e a mensagem de confirmação. Todos os dados vão para o CRM automaticamente.
        </p>
      </div>
      <FormBuilder automationId={automation.id} initial={formConfig} />
    </div>
  );
}
