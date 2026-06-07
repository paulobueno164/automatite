import "server-only";
import { upsertLead } from "./crm";

const CORE = new Set(["nome", "name", "email", "telefone", "phone", "empresa", "company"]);

function pickCore(payload: Record<string, unknown>) {
  const name = String(payload.nome ?? payload.name ?? "").trim();
  const email = String(payload.email ?? "").trim();
  const phone = String(payload.telefone ?? payload.phone ?? "").trim();
  const company = String(payload.empresa ?? payload.company ?? "").trim();
  return { name, email, phone, company };
}

/** Salva todos os campos do formulário no CRM (automático em todo envio). */
export async function captureFormToCrm(opts: {
  userId: string;
  automationId: string;
  executionId: string;
  payload: Record<string, unknown>;
  source?: string;
}) {
  if (opts.payload._trigger === "schedule") return null;

  const { name, email, phone, company } = pickCore(opts.payload);

  const data: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(opts.payload)) {
    if (key.startsWith("_")) continue;
    data[key] = value;
  }
  if (Object.keys(data).length === 0) return null;

  const firstValue = Object.values(data).find((v) => v != null && String(v).trim());
  const displayName = name || email || phone || (firstValue ? String(firstValue).slice(0, 80) : "Lead do formulário");

  return upsertLead({
    userId: opts.userId,
    automationId: opts.automationId,
    executionId: opts.executionId,
    name: displayName,
    email,
    phone,
    company,
    status: "new",
    note: "Enviado pelo formulário",
    source: opts.source ?? "formulário",
    data,
  });
}
