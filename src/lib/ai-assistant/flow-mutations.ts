import "server-only";
import { prisma } from "../db";
import { Action, ActionType, Flow, FlowSchema, Trigger } from "../flow-types";
import { ACTION_DEFAULTS } from "../action-schemas";
import { computeNextRun } from "../schedule";

export async function loadOwnedFlow(userId: string, automationId: string) {
  const a = await prisma.automation.findFirst({ where: { id: automationId, userId } });
  if (!a) return null;
  const flow: Flow = {
    name: a.name,
    description: a.description,
    category: a.category,
    trigger: JSON.parse(a.triggerJson),
    actions: JSON.parse(a.actionsJson),
  };
  return { automation: a, flow };
}

export async function saveFlow(userId: string, automationId: string, flow: Flow, active: boolean) {
  const parsed = FlowSchema.safeParse(flow);
  if (!parsed.success) throw new Error("Fluxo inválido");
  const valid = parsed.data;
  const nextRunAt =
    active && valid.trigger.type === "schedule"
      ? computeNextRun(String(valid.trigger.config?.cron ?? ""), new Date())
      : null;
  const updated = await prisma.automation.update({
    where: { id: automationId },
    data: {
      name: valid.name,
      description: valid.description,
      category: valid.category,
      triggerJson: JSON.stringify(valid.trigger),
      actionsJson: JSON.stringify(valid.actions),
      nextRunAt,
    },
  });
  return updated;
}

export async function duplicateAutomation(userId: string, automationId: string) {
  const loaded = await loadOwnedFlow(userId, automationId);
  if (!loaded) throw new Error("Automação não encontrada");
  const { flow } = loaded;
  const created = await prisma.automation.create({
    data: {
      userId,
      name: `${flow.name} (cópia)`,
      description: flow.description,
      category: flow.category,
      source: "manual",
      triggerJson: JSON.stringify(flow.trigger),
      actionsJson: JSON.stringify(flow.actions),
      active: false,
    },
  });
  return created;
}
