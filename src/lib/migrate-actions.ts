import "server-only";
import { prisma } from "./db";
import { Action } from "./flow-types";

/** Atualiza ações antigas (Pipedrive, Google Sheets) para o CRM e Registros internos. */
export function migrateLegacyActions(actions: Action[]): { actions: Action[]; changed: boolean } {
  let changed = false;
  const out = actions.map((action) => {
    if (action.type === "create_task") {
      const app = String(action.params?.app ?? "").toLowerCase();
      const label = (action.label ?? "").toLowerCase();
      const isCrm =
        app.includes("pipedrive") ||
        label.includes("crm") ||
        label.includes("contato") ||
        label.includes("lead");

      if (isCrm) {
        changed = true;
        return {
          type: "upsert_lead" as const,
          label: action.label?.includes("CRM") || action.label?.includes("contato") ? action.label : "Salvar no CRM",
          params: {
            name: "{nome}",
            email: "{email}",
            phone: "{telefone}",
            company: "{empresa}",
            status: "new",
            note: String(action.params?.title ?? "Lead recebido pela automação"),
          },
        };
      }
    }

    if (action.type === "append_sheet") {
      const app = String(action.params?.app ?? "").toLowerCase();
      if (!app || app.includes("google")) {
        changed = true;
        return {
          ...action,
          label: action.label?.includes("planilha") ? "Salvar lead" : action.label,
          params: {
            app: "automatite",
            sheet: String(action.params?.sheet ?? "Leads"),
          },
        };
      }
    }

    return action;
  });

  return { actions: out, changed };
}

/** Carrega ações e migra automaticamente no banco se ainda usarem integrações antigas. */
export async function loadMigratedActions(automationId: string, actionsJson: string): Promise<Action[]> {
  const actions: Action[] = JSON.parse(actionsJson);
  const { actions: migrated, changed } = migrateLegacyActions(actions);
  if (changed) {
    await prisma.automation.update({
      where: { id: automationId },
      data: { actionsJson: JSON.stringify(migrated) },
    });
  }
  return migrated;
}
