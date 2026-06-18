import "server-only";
import { prisma } from "./db";

export type { LeadStatus } from "./crm-constants";
export { LEAD_STATUSES } from "./crm-constants";

type UpsertLeadInput = {
  userId: string;
  automationId?: string;
  executionId?: string;
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
  status?: string;
  note?: string;
  source?: string;
  data?: Record<string, unknown>;
};

function normEmail(v?: string) {
  const s = v?.trim().toLowerCase();
  return s || null;
}

function normPhone(v?: string) {
  const s = v?.replace(/\D/g, "");
  return s || null;
}

async function findExistingLead(userId: string, email: string | null, phone: string | null) {
  if (!email && !phone) return null;

  return prisma.lead.findFirst({
    where: {
      userId,
      OR: [
        ...(email ? [{ email }] : []),
        ...(phone ? [{ phone }] : []),
      ],
    },
  });
}

export async function addLeadEvent(opts: {
  leadId: string;
  type: string;
  title: string;
  detail?: string;
  automationId?: string;
  executionId?: string;
  meta?: Record<string, unknown>;
}) {
  return prisma.leadEvent.create({
    data: {
      leadId: opts.leadId,
      type: opts.type,
      title: opts.title,
      detail: opts.detail ?? "",
      automationId: opts.automationId,
      executionId: opts.executionId,
      metaJson: JSON.stringify(opts.meta ?? {}),
    },
  });
}

/** Cria ou atualiza um lead no CRM e registra no histórico. */
export async function upsertLead(input: UpsertLeadInput) {
  const email = normEmail(input.email);
  const phone = normPhone(input.phone);
  const name = input.name?.trim() || "";
  const status = input.status?.trim() || "new";
  const extra = { ...(input.data ?? {}) };

  const existing = await findExistingLead(input.userId, email, phone);

  if (existing) {
    const updated = await prisma.lead.update({
      where: { id: existing.id },
      data: {
        name: name || existing.name,
        email: email ?? existing.email,
        phone: phone ?? existing.phone,
        company: input.company?.trim() || existing.company,
        status: status || existing.status,
        source: input.source ?? existing.source,
        dataJson: JSON.stringify({ ...JSON.parse(existing.dataJson), ...extra }),
        updatedAt: new Date(),
      },
    });
    await addLeadEvent({
      leadId: updated.id,
      type: "updated",
      title: "Lead atualizado",
      detail: input.note || "Dados atualizados pela automação",
      automationId: input.automationId,
      executionId: input.executionId,
    });
    return { id: updated.id, created: false, name: updated.name, email: updated.email };
  }

  const created = await prisma.lead.create({
    data: {
      userId: input.userId,
      name: name || email || phone || "Lead sem nome",
      email,
      phone,
      company: input.company?.trim() || null,
      status,
      source: input.source ?? "automação",
      automationId: input.automationId,
      dataJson: JSON.stringify(extra),
    },
  });
  await addLeadEvent({
    leadId: created.id,
    type: "created",
    title: "Lead criado",
    detail: input.note || "Novo contato registrado no CRM",
    automationId: input.automationId,
    executionId: input.executionId,
  });
  return { id: created.id, created: true, name: created.name, email: created.email };
}

/** Registra evento no lead se o e-mail ou telefone bater com um contato existente. */
export async function logLeadActivityByContact(opts: {
  userId: string;
  email?: string;
  phone?: string;
  type: string;
  title: string;
  detail: string;
  automationId?: string;
  executionId?: string;
}) {
  const lead = await findExistingLead(opts.userId, normEmail(opts.email), normPhone(opts.phone));
  if (!lead) return null;
  await addLeadEvent({
    leadId: lead.id,
    type: opts.type,
    title: opts.title,
    detail: opts.detail,
    automationId: opts.automationId,
    executionId: opts.executionId,
  });
  return lead.id;
}

export function leadToApi(lead: {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  status: string;
  source: string | null;
  dataJson: string;
  createdAt: Date;
  updatedAt: Date;
  events?: Array<{
    id: string;
    type: string;
    title: string;
    detail: string;
    automationId: string | null;
    executionId: string | null;
    metaJson: string;
    createdAt: Date;
  }>;
}) {
  return {
    id: lead.id,
    name: lead.name,
    email: lead.email,
    phone: lead.phone,
    company: lead.company,
    status: lead.status,
    source: lead.source,
    data: JSON.parse(lead.dataJson || "{}"),
    createdAt: lead.createdAt.toISOString(),
    updatedAt: lead.updatedAt.toISOString(),
    events: lead.events?.map((e) => ({
      id: e.id,
      type: e.type,
      title: e.title,
      detail: e.detail,
      automationId: e.automationId,
      executionId: e.executionId,
      meta: JSON.parse(e.metaJson || "{}"),
      createdAt: e.createdAt.toISOString(),
    })),
  };
}
