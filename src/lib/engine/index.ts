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

  let status: string = steps.some((s) => s.status === "error") ? "error" : "success";
  let pausedPath: string | undefined = undefined;
  let resumeToken: string | undefined = undefined;

  if (result.paused) {
    status = "paused";
    pausedPath = result.pausedPath;
    resumeToken = randomBytes(24).toString("hex");
  }

  await prisma.execution.update({
    where: { id: execution.id },
    data: {
      status,
      logJson: JSON.stringify(steps),
      pausedPath,
      resumeToken,
      inputJson: JSON.stringify(ctx.data), // Salva o estado atual dos dados
    },
  });

  return { executionId: execution.id, status, steps, userId: automation.userId };
}

/**
 * Retoma uma execução pausada.
 */
export async function resumeExecution(
  executionId: string,
  resumeToken: string,
  decision: "approve" | "reject"
): Promise<{ status: string; steps: ExecutionStep[] }> {
  const execution = await prisma.execution.findFirst({
    where: { id: executionId, resumeToken, status: "paused" },
    include: { automation: { include: { user: true } } },
  });

  if (!execution) throw new Error("Execução não encontrada ou token inválido");

  if (decision === "reject") {
    const steps: ExecutionStep[] = JSON.parse(execution.logJson);
    steps.push({
      action: "wait_for_approval",
      label: "Aprovação Humana",
      status: "skipped",
      detail: "Execução rejeitada pelo usuário",
    });
    await prisma.execution.update({
      where: { id: execution.id },
      data: { status: "error", logJson: JSON.stringify(steps), resumeToken: null },
    });
    return { status: "error", steps };
  }

  const actions: Action[] = JSON.parse(execution.automation.actionsJson);
  const steps: ExecutionStep[] = JSON.parse(execution.logJson);
  const payload = JSON.parse(execution.inputJson);

  let cachedIntegrations: Record<string, any> | null = null;
  const ctx = {
    data: payload,
    userId: execution.automation.userId,
    automationId: execution.automationId,
    executionId: execution.id,
    apiKey: resolveApiKey(execution.automation.user.anthropicKey),
    getIntegrations: async () => {
      if (!cachedIntegrations) {
        cachedIntegrations = await loadUserIntegrations(execution.automation.userId);
      }
      return cachedIntegrations;
    },
  };

  // Marcar o passo de aprovação como sucesso
  const lastStep = steps[steps.length - 1];
  if (lastStep && lastStep.action === "wait_for_approval" && lastStep.status === "paused") {
    lastStep.status = "success";
    lastStep.detail = "Aprovado pelo usuário";
  }

  // Retomar a partir do path salvo
  // IMPORTANTE: precisamos pular o passo de aprovação que já foi executado e está no logJson
  // O pausedPath aponta para o índice da ação wait_for_approval.
  // Para retomar, devemos começar na PRÓXIMA ação.
  const resumePath = execution.pausedPath;
  let result;
  if (resumePath) {
    const parts = resumePath.split(".");
    // Incrementa o último índice para pular o wait_for_approval
    parts[parts.length - 1] = (parseInt(parts[parts.length - 1]) + 1).toString();
    result = await runActionSequence(actions, ctx, steps, parts.join("."));
  } else {
    result = await runActionSequence(actions, ctx, steps);
  }

  let status: string = steps.some((s) => s.status === "error") ? "error" : "success";
  let pausedPath: string | null = null;
  let nextResumeToken: string | null = null;

  if (result.paused) {
    status = "paused";
    pausedPath = result.pausedPath;
    nextResumeToken = randomBytes(24).toString("hex");
  }

  await prisma.execution.update({
    where: { id: execution.id },
    data: {
      status,
      logJson: JSON.stringify(steps),
      pausedPath,
      resumeToken: nextResumeToken,
      inputJson: JSON.stringify(ctx.data),
    },
  });

  return { status, steps };
}

/**
 * Executa uma sequência de ações de forma recursiva (suporta branching).
 * @param resumePath Path no formato "0.if_true.1" para retomar de um ponto específico.
 */
async function runActionSequence(
  actions: Action[],
  ctx: EngineContext,
  steps: ExecutionStep[],
  resumePath?: string
): Promise<{ paused: boolean; pausedPath?: string }> {
  const resumeParts = resumePath ? resumePath.split(".") : [];
  const startIndex = resumeParts.length > 0 ? parseInt(resumeParts[0]) : 0;

  for (let i = startIndex; i < actions.length; i++) {
    const action = actions[i];
    const currentPath = resumePath && resumeParts.length > 1 ? resumeParts.slice(1).join(".") : undefined;

    // Se estamos resumindo e este NÃO é o passo que contém o sub-path, pulamos a execução
    // (já que o startIndex garante que começamos no lugar certo do array atual).
    // Mas se houver sub-path (ex: if_true), precisamos entrar nele.

    let step: ExecutionStep;

    if (currentPath && action.type === "condition") {
      // Estamos resumindo dentro de um branch de uma condição
      const branchKey = resumeParts[1] as "if_true" | "if_false";
      const branchActions = action.params?.[branchKey];
      if (Array.isArray(branchActions)) {
        const result = await runActionSequence(
          branchActions,
          ctx,
          steps,
          resumeParts.slice(2).join(".")
        );
        if (result.paused) {
          return { paused: true, pausedPath: `${i}.${branchKey}.${result.pausedPath}` };
        }
      }
      // Após terminar o branch, continuamos para a próxima ação do nível atual
      continue;
    }

    step = await runAction(action, ctx);
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
  }

  return { paused: false };
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
