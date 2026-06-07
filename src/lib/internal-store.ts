import "server-only";
import { prisma } from "./db";

/** Salva um registro interno (substitui Google Sheets para usuários leigos). */
export async function saveInternalRecord(opts: {
  userId: string;
  automationId?: string;
  label: string;
  data: Record<string, unknown>;
}) {
  const row = await prisma.record.create({
    data: {
      userId: opts.userId,
      automationId: opts.automationId,
      label: opts.label,
      dataJson: JSON.stringify(opts.data),
    },
  });
  return { id: row.id, label: row.label };
}

/** Cria uma tarefa interna (substitui CRM simples). */
export async function createInternalTask(opts: {
  userId: string;
  automationId?: string;
  title: string;
}) {
  const row = await prisma.internalTask.create({
    data: {
      userId: opts.userId,
      automationId: opts.automationId,
      title: opts.title,
    },
  });
  return { id: row.id, title: row.title };
}
