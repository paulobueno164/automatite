import { prisma } from "../db";
import { Action, ExecutionStep, Trigger } from "../flow-types";
import { resolveApiKey } from "../anthropic";
import { getTier, startOfMonth } from "../tiers";
import { loadUserIntegrations } from "../integrations";
import { computeNextRun } from "../schedule";
import { runAction, EngineContext } from "./actions";
import { captureFormToCrm } from "../capture-form-crm";

export class ExecutionLimitError extends Error {
  code = "LIMIT_EXECUTIONS";
}

/**
 * Executa uma automação salva: roda cada ação em ordem, registra o log
 * e grava uma Execution no banco. Um erro numa ação não interrompe as demais,
 * mas marca a execução como "error".
 *
 * Antes de rodar, valida o limite de execuções mensais do plano do dono.
 */
export async function runAutomation(
  automationId: string,
  payload: Record<string, unknown>
): Promise<{ executionId: string; status: string; steps: ExecutionStep[] }> {
  const automation = await prisma.automation.findUnique({
    where: { id: automationId },
    include: { user: true },
  });
  if (!automation) throw new Error("Automação não encontrada");
  if (!automation.active) throw new Error("Automação está inativa");

  // Enforcement do limite de execuções do ciclo (mês) conforme o tier do dono.
  const tier = getTier(automation.user.tier);
  if (tier.maxExecutionsPerMonth !== null) {
    const usedThisMonth = await prisma.execution.count({
      where: { automation: { userId: automation.userId }, createdAt: { gte: startOfMonth() } },
    });
    if (usedThisMonth >= tier.maxExecutionsPerMonth) {
      throw new ExecutionLimitError(
        `Limite de ${tier.maxExecutionsPerMonth} execuções/mês do plano ${tier.name} atingido. Faça upgrade para continuar.`
      );
    }
  }

  const actions: Action[] = JSON.parse(automation.actionsJson);
  const execution = await prisma.execution.create({
    data: { automationId, status: "running", inputJson: JSON.stringify(payload) },
  });

  await captureFormToCrm({
    userId: automation.userId,
    automationId,
    executionId: execution.id,
    payload,
  });

  let cachedIntegrations: Record<string, any> | null = null;
  const ctx = {
    data: { ...payload },
    userId: automation.userId,
    automationId,
    executionId: execution.id,
    apiKey: resolveApiKey(automation.user.anthropicKey),
    getIntegrations: async () => {
      if (!cachedIntegrations) {
        cachedIntegrations = await loadUserIntegrations(automation.userId);
      }
      return cachedIntegrations;
    },
  };
  const steps: ExecutionStep[] = [];
  await runActionSequence(actions, ctx, steps);

  const status = steps.some((s) => s.status === "error") ? "error" : "success";

  await prisma.execution.update({
    where: { id: execution.id },
    data: { status, logJson: JSON.stringify(steps) },
  });

  return { executionId: execution.id, status, steps };
}

/**
 * Executa uma sequência de ações de forma recursiva (suporta branching).
 */
async function runActionSequence(
  actions: Action[],
  ctx: EngineContext,
  steps: ExecutionStep[]
): Promise<void> {
  for (const action of actions) {
    const step = await runAction(action, ctx);
    steps.push(step);

    // Se for uma condição e tiver ramos, executa o ramo correspondente.
    if (action.type === "condition" && step.status === "success") {
      const result = (step.output as any)?.condition_result === true;
      const branchKey = result ? "if_true" : "if_false";
      const branchActions = action.params?.[branchKey];

      if (Array.isArray(branchActions) && branchActions.length > 0) {
        await runActionSequence(branchActions, ctx, steps);
      }
    }

    // Se a ação falhou, poderíamos interromper o fluxo aqui ou continuar.
    // O Automatite hoje continua, então mantemos a consistência.
  }
}

/**
 * Roda todas as automações agendadas cujo nextRunAt já venceu.
 * Recalcula o próximo horário após cada execução. Chamado pelo /api/cron/tick
 * e pelo scheduler in-process (instrumentation).
 */
export async function runDueSchedules(now: Date = new Date()): Promise<{ ran: number; ids: string[] }> {
  const due = await prisma.automation.findMany({
    where: { active: true, nextRunAt: { not: null, lte: now } },
    select: { id: true, triggerJson: true },
  });

  const ids: string[] = [];
  for (const a of due) {
    let trigger: Trigger;
    try {
      trigger = JSON.parse(a.triggerJson);
    } catch {
      continue;
    }
    if (trigger.type !== "schedule") continue;
    const cron = String(trigger.config?.cron ?? "");
    const tz = trigger.config?.timezone ? String(trigger.config.timezone) : undefined;

    // Executa (ignora erros de limite/individuais para não travar o lote).
    try {
      await runAutomation(a.id, { _trigger: "schedule", _firedAt: now.toISOString() });
      ids.push(a.id);
    } catch {
      // segue para a próxima; ainda assim reagendamos abaixo
    }

    const next = cron ? computeNextRun(cron, now, tz) : null;
    await prisma.automation.update({
      where: { id: a.id },
      data: { lastRunAt: now, nextRunAt: next },
    });
  }

  return { ran: ids.length, ids };
}
