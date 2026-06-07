import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { Flow } from "@/lib/flow-types";
import { getFormConfig } from "@/lib/form-config";
import { PublicForm } from "@/components/PublicForm";

export const dynamic = "force-dynamic";

type Props = { params: { id: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const automation = await prisma.automation.findUnique({ where: { id: params.id } });
  if (!automation?.active) return { title: "Formulário" };
  const flow: Flow = {
    name: automation.name,
    description: automation.description,
    category: automation.category,
    trigger: JSON.parse(automation.triggerJson),
    actions: JSON.parse(automation.actionsJson),
  };
  const form = getFormConfig(flow);
  return {
    title: form.title,
    description: form.description || undefined,
  };
}

export default async function PublicAutomationFormPage({ params }: Props) {
  const automation = await prisma.automation.findUnique({ where: { id: params.id } });
  if (!automation || !automation.active) notFound();

  const flow: Flow = {
    name: automation.name,
    description: automation.description,
    category: automation.category,
    trigger: JSON.parse(automation.triggerJson),
    actions: JSON.parse(automation.actionsJson),
  };

  const formConfig = getFormConfig(flow);

  return <PublicForm automationId={automation.id} config={formConfig} standalone />;
}
