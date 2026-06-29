import { randomBytes } from "crypto";
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
  payload: Record<string, unknown>,
  options: { isInternal?: boolean } = {}
): Promise<{ executionId: string; status: string; steps: ExecutionStep[]; userId: string }> {
  const automation = await prisma.automation.findUnique({
    where: { id: automationId },
    include: { user: true },
  });
  if (!automation) throw new Error("Automação não encontrada");
  if (!automation.active) throw new Error("Automação está inativa");

  // Proteção contra disparos externos de automações agendadas.
  const trigger: Trigger = JSON.parse(automation.triggerJson);
  if (trigger.type === "schedule" && !options.isInternal) {
    throw new Error("Agendamentos só podem ser disparados internamente");
  }

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
  const result = await runActionSequence(actions, ctx, steps);

  const status = result.paused
    ? "waiting"
    : steps.some((s) => s.status === "error")
    ? "error"
    : "success";

  const data: any = { status, logJson: JSON.stringify(steps) };
  if (result.paused) {
    data.pausedPath = result.pausedPath;
    data.resumeToken = randomBytes(24).toString("hex");

    sendApprovalNotification(data.resumeToken, steps);
  }

  await prisma.execution.update({
    where: { id: execution.id },
    data,
  });

  return { executionId: execution.id, status, steps, userId: automation.userId };
}

/** Notificação simulada de aprovação */
function sendApprovalNotification(token: string, steps: ExecutionStep[]) {
  const lastStep = steps[steps.length - 1];
  if (lastStep.action === "wait_for_approval") {
    const { to, subject } = (lastStep.output as any) || {};
    if (to) {
      console.log(`[APPROVAL] Link de aprovação para ${to}: /api/approve?token=${token}`);
      // Aqui poderíamos enviar e-mail real
    }
  }
}

/**
 * Executa uma sequência de ações de forma recursiva (suporta branching).
 */
async function runActionSequence(
  actions: Action[],
  ctx: EngineContext,
  steps: ExecutionStep[],
  options: { startIndex?: number; resumePath?: string } = {}
): Promise<{ paused: boolean; pausedPath?: string }> {
  const { startIndex = 0, resumePath } = options;

  // Se temos um resumePath, precisamos navegar até o nível correto.
  // Formato: "index.subKey.index.subKey..." onde subKey pode ser branchKey (condition) ou loop index.
  if (resumePath) {
    const parts = resumePath.split(".");
    const currentIndex = parseInt(parts[0], 10);
    const subKey = parts[1];
    const remainingPath = parts.slice(2).join(".");

    const action = actions[currentIndex];

    if (action.type === "condition") {
      const branchActions = action.params?.[subKey];
      if (Array.isArray(branchActions)) {
        const subResult = await runActionSequence(branchActions, ctx, steps, {
          resumePath: remainingPath || undefined,
        });
        if (subResult.paused) {
          return { paused: true, pausedPath: `${currentIndex}.${subKey}.${subResult.pausedPath}` };
        }
      }
    } else if (action.type === "loop") {
      const iterationIndex = parseInt(subKey, 10);
      const subActions = action.actionsJson ? JSON.parse(action.actionsJson) : (action.params?.actions || []);
      const loopItems = (await runAction(action, ctx)).output?.items as any[];

      if (Array.isArray(loopItems) && iterationIndex < loopItems.length) {
        const prevItem = ctx.data.loop_item;
        const prevIndex = ctx.data.loop_index;

        // Resume a partir da iteração que pausou
        for (let j = iterationIndex; j < loopItems.length; j++) {
          ctx.data.loop_item = loopItems[j];
          ctx.data.loop_index = j;

          const subResult = await runActionSequence(subActions, ctx, steps, {
            resumePath: j === iterationIndex ? remainingPath || undefined : undefined,
          });

          if (subResult.paused) {
            return { paused: true, pausedPath: `${currentIndex}.${j}.${subResult.pausedPath}` };
          }
        }
        ctx.data.loop_item = prevItem;
        ctx.data.loop_index = prevIndex;
      }
    }

    // Após terminar o ramo ou loop que estava pausado, continua a partir da próxima ação DESTE nível.
    return runActionSequence(actions, ctx, steps, { startIndex: currentIndex + 1 });
  }

  for (let i = startIndex; i < actions.length; i++) {
    const action = actions[i];
    const step = await runAction(action, ctx);
    steps.push(step);

    if (step.status === "paused") {
      return { paused: true, pausedPath: String(i) };
    }

    // Se for uma condição e tiver ramos, executa o ramo correspondente.
    if (action.type === "condition" && step.status === "success") {
      const result = (step.output as any)?.condition_result === true;
      const branchKey = result ? "if_true" : "if_false";
      const branchActions = action.params?.[branchKey];

      if (Array.isArray(branchActions) && branchActions.length > 0) {
        const subResult = await runActionSequence(branchActions, ctx, steps);
        if (subResult.paused) {
          return { paused: true, pausedPath: `${i}.${branchKey}.${subResult.pausedPath}` };
        }
      }
    }

    // Se for um loop, executa as ações para cada item.
    if (action.type === "loop" && step.status === "success") {
      const loopItems = (step.output as any)?.items;
      const subActions = action.actionsJson ? JSON.parse(action.actionsJson) : (action.params?.actions || []);

      if (Array.isArray(loopItems) && Array.isArray(subActions)) {
        const prevItem = ctx.data.loop_item;
        const prevIndex = ctx.data.loop_index;

        for (let j = 0; j < loopItems.length; j++) {
          ctx.data.loop_item = loopItems[j];
          ctx.data.loop_index = j;
          const subResult = await runActionSequence(subActions, ctx, steps);
          if (subResult.paused) {
            return { paused: true, pausedPath: `${i}.${j}.${subResult.pausedPath}` };
          }
        }

        ctx.data.loop_item = prevItem;
        ctx.data.loop_index = prevIndex;
      }
    }
  }
  return { paused: false };
}

/**
 * Retoma uma execução pausada.
 */
export async function resumeAutomation(
  executionId: string,
  resumeToken: string
): Promise<{ success: boolean; status: string; steps: ExecutionStep[] }> {
  const execution = await prisma.execution.findUnique({
    where: { id: executionId },
    include: { automation: { include: { user: true } } },
  });

  if (!execution) throw new Error("Execução não encontrada");
  if (execution.status !== "waiting") throw new Error("Esta execução não está aguardando aprovação");
  if (execution.resumeToken !== resumeToken) throw new Error("Token de aprovação inválido");

  const automation = execution.automation;
  const payload = JSON.parse(execution.inputJson);
  const actions: Action[] = JSON.parse(automation.actionsJson);
  const steps: ExecutionStep[] = JSON.parse(execution.logJson);

  // Marca o passo de pausa como sucesso para continuar
  // Procuramos o último passo que está como 'paused'
  const pausedStepIdx = steps.findLastIndex((s) => s.status === "paused");
  if (pausedStepIdx !== -1) {
    steps[pausedStepIdx].status = "success";
    steps[pausedStepIdx].detail = "Aprovação recebida manualmente";
  }

  let cachedIntegrations: Record<string, any> | null = null;
  const ctx = {
    data: { ...payload },
    userId: automation.userId,
    automationId: automation.id,
    executionId: execution.id,
    apiKey: resolveApiKey(automation.user.anthropicKey),
    getIntegrations: async () => {
      if (!cachedIntegrations) {
        cachedIntegrations = await loadUserIntegrations(automation.userId);
      }
      return cachedIntegrations;
    },
  };

  // Retoma usando o pausedPath salvo
  const result = await runActionSequence(actions, ctx, steps, {
    resumePath: execution.pausedPath || undefined,
  });

  const status = result.paused
    ? "waiting"
    : steps.some((s) => s.status === "error")
    ? "error"
    : "success";

  const updateData: any = { status, logJson: JSON.stringify(steps) };
  if (result.paused) {
    updateData.pausedPath = result.pausedPath;
    updateData.resumeToken = randomBytes(24).toString("hex");
    sendApprovalNotification(updateData.resumeToken, steps);
  } else {
    updateData.pausedPath = null;
    updateData.resumeToken = null;
  }

  await prisma.execution.update({
    where: { id: execution.id },
    data: updateData,
  });

  return { success: true, status, steps };
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
      await runAutomation(
        a.id,
        { _trigger: "schedule", _firedAt: now.toISOString() },
        { isInternal: true }
      );
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
