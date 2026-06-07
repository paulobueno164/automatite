import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getTier } from "@/lib/tiers";
import { FlowSchema, Trigger } from "@/lib/flow-types";
import { computeNextRun } from "@/lib/schedule";
import { FormConfig } from "@/lib/form-config";
import { prepareFormHtmlForSave, validateFormHtml } from "@/lib/form-template";

type Params = { params: { id: string } };

// Calcula nextRunAt para um trigger de agendamento ativo; null caso contrário.
function nextRunFor(trigger: Trigger, active: boolean): Date | null {
  if (!active || trigger.type !== "schedule") return null;
  const cron = String(trigger.config?.cron ?? "");
  const tz = trigger.config?.timezone ? String(trigger.config.timezone) : undefined;
  return cron ? computeNextRun(cron, new Date(), tz) : null;
}

// Busca a automação garantindo que pertence ao usuário logado.
async function findOwned(id: string, userId: string) {
  const automation = await prisma.automation.findUnique({ where: { id } });
  if (!automation || automation.userId !== userId) return null;
  return automation;
}

// GET /api/automations/[id] — detalhes + últimas execuções
export async function GET(_req: NextRequest, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const automation = await prisma.automation.findUnique({
    where: { id: params.id },
    include: { executions: { orderBy: { createdAt: "desc" }, take: 20 } },
  });
  if (!automation || automation.userId !== user.id) {
    return NextResponse.json({ error: "Não encontrada" }, { status: 404 });
  }
  return NextResponse.json(automation);
}

// PATCH /api/automations/[id] — ativar/desativar ou renomear
export async function PATCH(req: NextRequest, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const automation = await findOwned(params.id, user.id);
  if (!automation) return NextResponse.json({ error: "Não encontrada" }, { status: 404 });

  const body = await req.json();
  const data: Record<string, unknown> = {};

  // Edição do fluxo completo (vinda do editor visual).
  let trigger: Trigger = JSON.parse(automation.triggerJson);
  if (body.flow) {
    const parsed = FlowSchema.safeParse(body.flow);
    if (!parsed.success) {
      return NextResponse.json({ error: "Fluxo inválido", details: parsed.error.flatten() }, { status: 400 });
    }
    const flow = parsed.data;
    trigger = flow.trigger;
    data.name = flow.name;
    data.description = flow.description;
    data.category = flow.category;
    data.triggerJson = JSON.stringify(flow.trigger);
    data.actionsJson = JSON.stringify(flow.actions);
  }

  // Determina o estado final de "active" (pode vir no body ou manter o atual).
  const willBeActive = typeof body.active === "boolean" ? body.active : automation.active;

  if (typeof body.active === "boolean") {
    // Ao ATIVAR, valida o limite de automações ativas do plano.
    if (body.active && !automation.active) {
      const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
      const tier = getTier(dbUser?.tier ?? "free");
      if (tier.maxActiveAutomations !== null) {
        const activeCount = await prisma.automation.count({ where: { userId: user.id, active: true } });
        if (activeCount >= tier.maxActiveAutomations) {
          return NextResponse.json(
            {
              error: `Seu plano ${tier.name} permite ${tier.maxActiveAutomations} automação(ões) ativa(s). Faça upgrade para ativar mais.`,
              code: "LIMIT_ACTIVE",
            },
            { status: 402 }
          );
        }
      }
    }
    data.active = body.active;
  }
  if (typeof body.name === "string") data.name = body.name;

  if (body.formConfig) {
    const raw = body.formConfig as FormConfig;
    const formConfig: FormConfig = raw.customHtml?.trim()
      ? { ...raw, customHtml: prepareFormHtmlForSave(raw.customHtml) }
      : raw;
    if (formConfig.customHtml?.trim()) {
      const v = validateFormHtml(formConfig.customHtml, formConfig.fields ?? []);
      if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
    }
    trigger = JSON.parse(automation.triggerJson);
    trigger.config = { ...(trigger.config ?? {}), form: formConfig };
    data.triggerJson = JSON.stringify(trigger);
  }

  // Recalcula o agendamento sempre que o gatilho ou o estado ativo mudarem.
  data.nextRunAt = nextRunFor(trigger, willBeActive);

  const updated = await prisma.automation.update({ where: { id: params.id }, data });
  return NextResponse.json(updated);
}

// DELETE /api/automations/[id]
export async function DELETE(_req: NextRequest, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const automation = await findOwned(params.id, user.id);
  if (!automation) return NextResponse.json({ error: "Não encontrada" }, { status: 404 });

  await prisma.automation.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
