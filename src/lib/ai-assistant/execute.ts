import "server-only";
import { prisma } from "../db";
import { getTier, startOfMonth } from "../tiers";
import { TEMPLATES, getTemplate } from "../templates";
import { FlowSchema, Trigger } from "../flow-types";
import { getAutomationReadiness } from "../automation-readiness";
import { buildReadinessContext } from "../readiness-context";
import { loadUserIntegrations } from "../integrations";
import { generateFlow, resolveApiKey } from "../anthropic";
import { computeNextRun } from "../schedule";
import { runAutomation } from "../engine";
import { upsertLead, addLeadEvent, leadToApi } from "../crm";
import { createInternalTask, saveInternalRecord } from "../internal-store";
import { isPlatformEmailReady, isPlatformSmsReady, PLATFORM_SERVICES } from "../platform-services";
import { duplicateAutomation, loadOwnedFlow, saveFlow } from "./flow-mutations";
import {
  mutateForm,
  buildNewField,
  parseFieldType,
  loadFlowForAutomation,
} from "./form-mutations";
import { ActionType, Action } from "../flow-types";
import { ACTION_DEFAULTS } from "../action-schemas";
import { generateApiKey } from "../api-key-auth";
import { getFormConfig } from "../form-config";
import { prepareFormHtmlForSave, validateFormHtml } from "../form-template";
import { encryptJson, decryptJson } from "../crypto";
import { getProvider } from "../integrations";
import { verifySmtpCredentials } from "../smtp-verify";

export type ToolResult = { ok: true; data: unknown } | { ok: false; error: string };

async function ownedAutomation(userId: string, id: string) {
  return prisma.automation.findFirst({ where: { id, userId } });
}

export async function executeAssistantTool(
  userId: string,
  userEmail: string,
  name: string,
  input: Record<string, unknown>,
  appOrigin: string
): Promise<ToolResult> {
  try {
    switch (name) {
      case "get_account_overview": {
        const [user, automations, leads, tasks, records, integrations, execMonth] = await Promise.all([
          prisma.user.findUnique({ where: { id: userId } }),
          prisma.automation.findMany({ where: { userId }, select: { id: true, active: true } }),
          prisma.lead.count({ where: { userId } }),
          prisma.internalTask.count({ where: { userId, status: "open" } }),
          prisma.record.count({ where: { userId } }),
          prisma.integration.findMany({ where: { userId }, select: { provider: true } }),
          prisma.execution.count({
            where: { automation: { userId }, createdAt: { gte: startOfMonth() } },
          }),
        ]);
        const tier = getTier(user?.tier ?? "free");
        return {
          ok: true,
          data: {
            email: userEmail,
            tier: tier.name,
            limits: {
              maxActiveAutomations: tier.maxActiveAutomations,
              maxExecutionsPerMonth: tier.maxExecutionsPerMonth,
            },
            usage: {
              activeAutomations: automations.filter((a) => a.active).length,
              totalAutomations: automations.length,
              executionsThisMonth: execMonth,
              leads,
              openTasks: tasks,
              records,
            },
            integrations: integrations.map((i) => i.provider),
            hasAnthropicKey: !!user?.anthropicKey,
            note: "Mudança de plano deve ser feita manualmente em Planos.",
          },
        };
      }

      case "list_automations": {
        const items = await prisma.automation.findMany({
          where: { userId },
          orderBy: { createdAt: "desc" },
          include: { _count: { select: { executions: true } } },
        });
        return {
          ok: true,
          data: items.map((a) => ({
            id: a.id,
            name: a.name,
            active: a.active,
            category: a.category,
            source: a.source,
            executions: a._count.executions,
            formUrl: `${appOrigin}/f/${a.id}`,
          })),
        };
      }

      case "get_automation_details": {
        const id = String(input.automation_id);
        const a = await ownedAutomation(userId, id);
        if (!a) return { ok: false, error: "Automação não encontrada" };
        const flow = {
          name: a.name,
          description: a.description,
          category: a.category,
          trigger: JSON.parse(a.triggerJson),
          actions: JSON.parse(a.actionsJson),
        };
        const readinessCtx = await buildReadinessContext(userId);
        const readiness = getAutomationReadiness(flow, readinessCtx, id);
        const executions = await prisma.execution.findMany({
          where: { automationId: id },
          orderBy: { createdAt: "desc" },
          take: 5,
        });
        return {
          ok: true,
          data: {
            id: a.id,
            active: a.active,
            flow,
            formConfig: getFormConfig(flow),
            formUrl: `${appOrigin}/f/${a.id}`,
            webhookUrl: `${appOrigin}/api/trigger/${a.id}`,
            readiness: {
              ready: readiness.ready,
              missing: readiness.items.filter((i) => i.status === "missing").map((i) => i.requirement),
            },
            recentExecutions: executions.map((e) => ({
              id: e.id,
              status: e.status,
              createdAt: e.createdAt,
            })),
          },
        };
      }

      case "list_templates":
        return {
          ok: true,
          data: TEMPLATES.map((t) => ({ id: t.id, name: t.flow.name, segment: t.segment, emoji: t.emoji })),
        };

      case "list_leads": {
        const limit = Math.min(Number(input.limit) || 20, 50);
        const where: { userId: string; status?: string } = { userId };
        if (input.status) where.status = String(input.status);
        const leads = await prisma.lead.findMany({ where, orderBy: { updatedAt: "desc" }, take: limit });
        return { ok: true, data: leads.map((l) => leadToApi(l)) };
      }

      case "get_lead_details": {
        const lead = await prisma.lead.findFirst({
          where: { id: String(input.lead_id), userId },
          include: { events: { orderBy: { createdAt: "desc" }, take: 15 } },
        });
        if (!lead) return { ok: false, error: "Lead não encontrado" };
        return { ok: true, data: leadToApi(lead) };
      }

      case "list_records": {
        const limit = Math.min(Number(input.limit) || 20, 50);
        const where: { userId: string; label?: string } = { userId };
        if (input.label) where.label = String(input.label);
        const rows = await prisma.record.findMany({ where, orderBy: { createdAt: "desc" }, take: limit });
        return {
          ok: true,
          data: rows.map((r) => ({
            id: r.id,
            label: r.label,
            data: JSON.parse(r.dataJson),
            createdAt: r.createdAt,
          })),
        };
      }

      case "list_tasks": {
        const where: { userId: string; status?: string } = { userId };
        if (input.status) where.status = String(input.status);
        const tasks = await prisma.internalTask.findMany({ where, orderBy: { createdAt: "desc" }, take: 30 });
        return { ok: true, data: tasks };
      }

      case "list_integrations": {
        const creds = await loadUserIntegrations(userId);
        const safe: Record<string, Record<string, string>> = {};
        for (const [provider, data] of Object.entries(creds)) {
          safe[provider] = Object.fromEntries(
            Object.entries(data).filter(([k]) => !k.toLowerCase().includes("password") && k !== "apiKey" && k !== "accessToken" && k !== "serviceAccountJson")
          );
        }
        return { ok: true, data: safe };
      }

      case "list_api_keys": {
        const keys = await prisma.apiKey.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
        return {
          ok: true,
          data: keys.map((k) => ({
            id: k.id,
            name: k.name,
            prefix: k.keyPrefix,
            createdAt: k.createdAt,
            lastUsedAt: k.lastUsedAt,
          })),
        };
      }

      case "get_platform_services":
        return {
          ok: true,
          data: {
            services: PLATFORM_SERVICES,
            platformEmailReady: isPlatformEmailReady(),
            platformSmsReady: isPlatformSmsReady(),
            platformAnthropicReady: !!process.env.ANTHROPIC_API_KEY,
          },
        };

      case "search_leads": {
        const q = String(input.query).trim().toLowerCase();
        const limit = Math.min(Number(input.limit) || 20, 50);
        const all = await prisma.lead.findMany({
          where: { userId },
          orderBy: { updatedAt: "desc" },
          take: 200,
        });
        const matched = all
          .filter((l) => {
            const blob = [l.name, l.email, l.phone, l.company, l.dataJson].filter(Boolean).join(" ").toLowerCase();
            return blob.includes(q);
          })
          .slice(0, limit);
        return { ok: true, data: matched.map((l) => leadToApi(l)) };
      }

      case "list_executions": {
        const limit = Math.min(Number(input.limit) || 20, 50);
        const rows = await prisma.execution.findMany({
          where: input.automation_id
            ? { automationId: String(input.automation_id), automation: { userId } }
            : { automation: { userId } },
          orderBy: { createdAt: "desc" },
          take: limit,
          include: { automation: { select: { name: true } } },
        });
        return {
          ok: true,
          data: rows.map((e) => ({
            id: e.id,
            automationId: e.automationId,
            automationName: e.automation.name,
            status: e.status,
            createdAt: e.createdAt,
          })),
        };
      }

      case "get_execution_details": {
        const ex = await prisma.execution.findFirst({
          where: { id: String(input.execution_id), automation: { userId } },
          include: { automation: { select: { name: true } } },
        });
        if (!ex) return { ok: false, error: "Execução não encontrada" };
        return {
          ok: true,
          data: {
            id: ex.id,
            automationName: ex.automation.name,
            status: ex.status,
            input: JSON.parse(ex.inputJson || "{}"),
            steps: JSON.parse(ex.logJson || "[]"),
            createdAt: ex.createdAt,
          },
        };
      }

      case "get_form_config": {
        const loaded = await loadFlowForAutomation(userId, String(input.automation_id));
        if (!loaded) return { ok: false, error: "Automação não encontrada" };
        return { ok: true, data: getFormConfig(loaded.flow) };
      }

      case "create_automation_from_template": {
        const t = getTemplate(String(input.template_id));
        if (!t) return { ok: false, error: "Template não encontrado" };
        const flow = t.flow;
        const created = await prisma.automation.create({
          data: {
            userId,
            name: flow.name,
            description: flow.description,
            category: flow.category,
            source: "template",
            triggerJson: JSON.stringify(flow.trigger),
            actionsJson: JSON.stringify(flow.actions),
            active: false,
          },
        });
        return { ok: true, data: { id: created.id, name: created.name, url: `/automations/${created.id}` } };
      }

      case "create_automation_from_description": {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        const { flow, usedAI } = await generateFlow(
          {
            description: String(input.description),
            apps: input.apps ? String(input.apps) : undefined,
            fields: input.fields ? String(input.fields) : undefined,
          },
          user?.anthropicKey
        );
        const created = await prisma.automation.create({
          data: {
            userId,
            name: flow.name,
            description: flow.description,
            category: flow.category,
            source: "ai",
            triggerJson: JSON.stringify(flow.trigger),
            actionsJson: JSON.stringify(flow.actions),
            active: false,
          },
        });
        return { ok: true, data: { id: created.id, name: created.name, usedAI, url: `/automations/${created.id}` } };
      }

      case "update_automation": {
        const id = String(input.automation_id);
        const a = await ownedAutomation(userId, id);
        if (!a) return { ok: false, error: "Automação não encontrada" };
        const data: Record<string, unknown> = {};
        if (input.name) data.name = String(input.name);
        if (input.description !== undefined) data.description = String(input.description);
        if (input.flow_json) {
          const parsed = FlowSchema.safeParse(JSON.parse(String(input.flow_json)));
          if (!parsed.success) return { ok: false, error: "Fluxo JSON inválido" };
          const flow = parsed.data;
          data.name = flow.name;
          data.description = flow.description;
          data.category = flow.category;
          data.triggerJson = JSON.stringify(flow.trigger);
          data.actionsJson = JSON.stringify(flow.actions);
        }
        const trigger: Trigger = data.triggerJson
          ? JSON.parse(String(data.triggerJson))
          : JSON.parse(a.triggerJson);
        data.nextRunAt = a.active && trigger.type === "schedule"
          ? computeNextRun(String(trigger.config?.cron ?? ""), new Date())
          : a.active
            ? a.nextRunAt
            : null;
        const updated = await prisma.automation.update({ where: { id }, data });
        return { ok: true, data: { id: updated.id, name: updated.name } };
      }

      case "set_automation_active": {
        const id = String(input.automation_id);
        const active = Boolean(input.active);
        const a = await ownedAutomation(userId, id);
        if (!a) return { ok: false, error: "Automação não encontrada" };
        if (active && !a.active) {
          const user = await prisma.user.findUnique({ where: { id: userId } });
          const tier = getTier(user?.tier ?? "free");
          if (tier.maxActiveAutomations !== null) {
            const count = await prisma.automation.count({ where: { userId, active: true } });
            if (count >= tier.maxActiveAutomations) {
              return { ok: false, error: `Limite do plano ${tier.name}: ${tier.maxActiveAutomations} automação(ões) ativa(s).` };
            }
          }
        }
        const trigger: Trigger = JSON.parse(a.triggerJson);
        const updated = await prisma.automation.update({
          where: { id },
          data: {
            active,
            nextRunAt: active && trigger.type === "schedule"
              ? computeNextRun(String(trigger.config?.cron ?? ""), new Date())
              : null,
          },
        });
        return { ok: true, data: { id: updated.id, active: updated.active } };
      }

      case "delete_automation": {
        const id = String(input.automation_id);
        const a = await ownedAutomation(userId, id);
        if (!a) return { ok: false, error: "Automação não encontrada" };
        await prisma.automation.delete({ where: { id } });
        return { ok: true, data: { deleted: id } };
      }

      case "duplicate_automation": {
        const created = await duplicateAutomation(userId, String(input.automation_id));
        return { ok: true, data: { id: created.id, name: created.name, url: `/automations/${created.id}` } };
      }

      case "update_automation_action": {
        const loaded = await loadOwnedFlow(userId, String(input.automation_id));
        if (!loaded) return { ok: false, error: "Automação não encontrada" };
        const idx = Number(input.action_index);
        if (idx < 0 || idx >= loaded.flow.actions.length) return { ok: false, error: "Índice de passo inválido" };
        const action = { ...loaded.flow.actions[idx] } as Action;
        if (input.label) action.label = String(input.label);
        if (input.type) action.type = String(input.type) as ActionType;
        if (input.params_json) action.params = JSON.parse(String(input.params_json));
        loaded.flow.actions[idx] = action;
        await saveFlow(userId, String(input.automation_id), loaded.flow, loaded.automation.active);
        return { ok: true, data: { updated_index: idx, action } };
      }

      case "add_automation_action": {
        const loaded = await loadOwnedFlow(userId, String(input.automation_id));
        if (!loaded) return { ok: false, error: "Automação não encontrada" };
        const type = String(input.type) as ActionType;
        const action: Action = {
          type,
          label: input.label ? String(input.label) : type,
          params: input.params_json ? JSON.parse(String(input.params_json)) : { ...ACTION_DEFAULTS[type] },
        };
        const pos = input.position !== undefined ? Number(input.position) : loaded.flow.actions.length;
        loaded.flow.actions.splice(pos, 0, action);
        await saveFlow(userId, String(input.automation_id), loaded.flow, loaded.automation.active);
        return { ok: true, data: { position: pos, action } };
      }

      case "remove_automation_action": {
        const loaded = await loadOwnedFlow(userId, String(input.automation_id));
        if (!loaded) return { ok: false, error: "Automação não encontrada" };
        const idx = Number(input.action_index);
        if (loaded.flow.actions.length <= 1) return { ok: false, error: "A automação precisa ter ao menos um passo" };
        if (idx < 0 || idx >= loaded.flow.actions.length) return { ok: false, error: "Índice inválido" };
        const removed = loaded.flow.actions.splice(idx, 1)[0];
        await saveFlow(userId, String(input.automation_id), loaded.flow, loaded.automation.active);
        return { ok: true, data: { removed_index: idx, removed } };
      }

      case "set_automation_schedule": {
        const loaded = await loadOwnedFlow(userId, String(input.automation_id));
        if (!loaded) return { ok: false, error: "Automação não encontrada" };
        loaded.flow.trigger = {
          type: "schedule",
          config: { ...loaded.flow.trigger.config, cron: String(input.cron) },
        };
        await saveFlow(userId, String(input.automation_id), loaded.flow, loaded.automation.active);
        return { ok: true, data: { cron: input.cron } };
      }

      case "update_email_layout": {
        const existing = await prisma.integration.findUnique({
          where: { userId_provider: { userId, provider: "smtp" } },
        });
        if (!existing) return { ok: false, error: "Configure o SMTP primeiro em Configurações → Seu e-mail" };
        const creds = decryptJson<Record<string, string>>(existing.dataEnc);
        if (input.template_footer) creds.templateFooter = String(input.template_footer);
        if (input.template_accent_color) creds.templateAccentColor = String(input.template_accent_color);
        if (input.template_html) creds.templateHtml = String(input.template_html);
        await prisma.integration.update({
          where: { id: existing.id },
          data: { dataEnc: encryptJson(creds) },
        });
        return { ok: true, data: { saved: true } };
      }

      case "update_form_config": {
        const id = String(input.automation_id);
        const a = await ownedAutomation(userId, id);
        if (!a) return { ok: false, error: "Automação não encontrada" };
        const raw = JSON.parse(String(input.form_config_json));
        const formConfig = raw.customHtml?.trim()
          ? { ...raw, customHtml: prepareFormHtmlForSave(raw.customHtml) }
          : raw;
        if (formConfig.customHtml?.trim()) {
          const v = validateFormHtml(formConfig.customHtml, formConfig.fields ?? []);
          if (!v.ok) return { ok: false, error: v.error };
        }
        const trigger: Trigger = JSON.parse(a.triggerJson);
        trigger.config = { ...(trigger.config ?? {}), form: formConfig };
        await prisma.automation.update({ where: { id }, data: { triggerJson: JSON.stringify(trigger) } });
        return { ok: true, data: { automation_id: id, saved: true } };
      }

      case "form_add_field": {
        const aid = String(input.automation_id);
        const config = await mutateForm(userId, aid, (c) => {
          const options = input.options
            ? String(input.options).split(",").map((s) => s.trim()).filter(Boolean)
            : undefined;
          const field = buildNewField(String(input.label), c.fields, {
            id: input.field_id ? String(input.field_id) : undefined,
            type: parseFieldType(input.field_type),
            required: Boolean(input.required),
            placeholder: input.placeholder ? String(input.placeholder) : undefined,
            options,
          });
          return { ...c, fields: [...c.fields, field] };
        });
        return { ok: true, data: config };
      }

      case "form_remove_field": {
        const fid = String(input.field_id);
        const config = await mutateForm(userId, String(input.automation_id), (c) => ({
          ...c,
          fields: c.fields.filter((f) => f.id !== fid),
        }));
        return { ok: true, data: config };
      }

      case "form_update_field": {
        const fid = String(input.field_id);
        const config = await mutateForm(userId, String(input.automation_id), (c) => ({
          ...c,
          fields: c.fields.map((f) =>
            f.id !== fid
              ? f
              : {
                  ...f,
                  ...(input.label ? { label: String(input.label) } : {}),
                  ...(input.field_type ? { type: parseFieldType(input.field_type) } : {}),
                  ...(input.required !== undefined ? { required: Boolean(input.required) } : {}),
                  ...(input.placeholder !== undefined ? { placeholder: String(input.placeholder) } : {}),
                }
          ),
        }));
        return { ok: true, data: config };
      }

      case "form_update_style": {
        const config = await mutateForm(userId, String(input.automation_id), (c) => ({
          ...c,
          style: {
            ...c.style,
            ...(input.background_color ? { backgroundColor: String(input.background_color) } : {}),
            ...(input.background_image_url !== undefined
              ? { backgroundImageUrl: String(input.background_image_url) || undefined }
              : {}),
            ...(input.accent_color ? { accentColor: String(input.accent_color) } : {}),
            ...(input.button_label ? { buttonLabel: String(input.button_label) } : {}),
            ...(input.card_background ? { cardBackground: String(input.card_background) } : {}),
          },
        }));
        return { ok: true, data: config };
      }

      case "form_update_success_screen": {
        const config = await mutateForm(userId, String(input.automation_id), (c) => ({
          ...c,
          success: {
            ...c.success,
            ...(input.title ? { title: String(input.title) } : {}),
            ...(input.message ? { message: String(input.message) } : {}),
            ...(input.show_another_button !== undefined
              ? { showAnotherButton: Boolean(input.show_another_button) }
              : {}),
            ...(input.another_button_label ? { anotherButtonLabel: String(input.another_button_label) } : {}),
          },
        }));
        return { ok: true, data: config };
      }

      case "form_set_title": {
        const config = await mutateForm(userId, String(input.automation_id), (c) => ({
          ...c,
          ...(input.title ? { title: String(input.title) } : {}),
          ...(input.description !== undefined ? { description: String(input.description) } : {}),
        }));
        return { ok: true, data: config };
      }

      case "form_update_html": {
        const aid = String(input.automation_id);
        const html = input.custom_html !== undefined ? String(input.custom_html).trim() : "";
        const config = await mutateForm(userId, aid, (c) => {
          const next = { ...c, customHtml: html || undefined };
          if (html) {
            const v = validateFormHtml(html, next.fields);
            if (!v.ok) throw new Error(v.error);
          }
          return next;
        });
        return { ok: true, data: config };
      }

      case "test_automation": {
        const id = String(input.automation_id);
        // Otimização Bolt: já busca com o usuário para evitar query redundante no engine
        const a = await prisma.automation.findFirst({
          where: { id, userId },
          include: { user: true },
        });
        if (!a) return { ok: false, error: "Automação não encontrada" };
        const payload = JSON.parse(String(input.payload_json));
        const result = await runAutomation(id, payload, { automation: a });
        return { ok: true, data: result };
      }

      case "update_lead_status": {
        const lead = await prisma.lead.findFirst({ where: { id: String(input.lead_id), userId } });
        if (!lead) return { ok: false, error: "Lead não encontrado" };
        const status = String(input.status);
        const updated = await prisma.lead.update({ where: { id: lead.id }, data: { status } });
        await addLeadEvent({
          leadId: lead.id,
          type: "status_change",
          title: "Status alterado (assistente)",
          detail: `${lead.status} → ${status}`,
        });
        return { ok: true, data: leadToApi(updated) };
      }

      case "create_lead": {
        const extra = input.extra_data_json ? JSON.parse(String(input.extra_data_json)) : {};
        const r = await upsertLead({
          userId,
          name: String(input.name),
          email: input.email ? String(input.email) : undefined,
          phone: input.phone ? String(input.phone) : undefined,
          company: input.company ? String(input.company) : undefined,
          status: input.status ? String(input.status) : "new",
          note: input.note ? String(input.note) : "Criado pelo assistente",
          source: "assistente",
          data: extra,
        });
        return { ok: true, data: r };
      }

      case "update_lead": {
        const lead = await prisma.lead.findFirst({ where: { id: String(input.lead_id), userId } });
        if (!lead) return { ok: false, error: "Lead não encontrado" };
        const extra = input.extra_data_json
          ? { ...JSON.parse(lead.dataJson || "{}"), ...JSON.parse(String(input.extra_data_json)) }
          : JSON.parse(lead.dataJson || "{}");
        const updated = await prisma.lead.update({
          where: { id: lead.id },
          data: {
            name: input.name ? String(input.name) : lead.name,
            email: input.email !== undefined ? String(input.email) || null : lead.email,
            phone: input.phone !== undefined ? String(input.phone) || null : lead.phone,
            company: input.company !== undefined ? String(input.company) || null : lead.company,
            dataJson: JSON.stringify(extra),
          },
        });
        await addLeadEvent({
          leadId: lead.id,
          type: "updated",
          title: "Lead editado (assistente)",
          detail: "Dados atualizados pelo assistente",
        });
        return { ok: true, data: leadToApi(updated) };
      }

      case "delete_lead": {
        const lead = await prisma.lead.findFirst({ where: { id: String(input.lead_id), userId } });
        if (!lead) return { ok: false, error: "Lead não encontrado" };
        await prisma.leadEvent.deleteMany({ where: { leadId: lead.id } });
        await prisma.lead.delete({ where: { id: lead.id } });
        return { ok: true, data: { deleted: lead.id } };
      }

      case "update_task_status": {
        const task = await prisma.internalTask.findFirst({
          where: { id: String(input.task_id), userId },
        });
        if (!task) return { ok: false, error: "Tarefa não encontrada" };
        const status = input.status === "done" ? "done" : "open";
        const updated = await prisma.internalTask.update({ where: { id: task.id }, data: { status } });
        return { ok: true, data: updated };
      }

      case "create_task": {
        const r = await createInternalTask({ userId, title: String(input.title) });
        return { ok: true, data: r };
      }

      case "delete_task": {
        const task = await prisma.internalTask.findFirst({
          where: { id: String(input.task_id), userId },
        });
        if (!task) return { ok: false, error: "Tarefa não encontrada" };
        await prisma.internalTask.delete({ where: { id: task.id } });
        return { ok: true, data: { deleted: task.id } };
      }

      case "create_record": {
        const data = JSON.parse(String(input.data_json));
        const r = await saveInternalRecord({ userId, label: String(input.label), data });
        return { ok: true, data: r };
      }

      case "delete_record": {
        const rec = await prisma.record.findFirst({ where: { id: String(input.record_id), userId } });
        if (!rec) return { ok: false, error: "Registro não encontrado" };
        await prisma.record.delete({ where: { id: rec.id } });
        return { ok: true, data: { deleted: rec.id } };
      }

      case "connect_integration": {
        const provider = String(input.provider);
        const def = getProvider(provider);
        if (!def) return { ok: false, error: "Provider inválido" };
        const data = JSON.parse(String(input.credentials_json)) as Record<string, string>;
        const creds: Record<string, string> = {};
        const testConnection = input.test_connection !== false;
        const isSmtp = provider === "smtp";
        for (const field of def.fields) {
          const value = data[field.key];
          const skipRequired = isSmtp && field.key === "password";
          if (!field.optional && !skipRequired && (typeof value !== "string" || !value.trim())) {
            return { ok: false, error: `Campo obrigatório: ${field.label}` };
          }
          if (typeof value === "string" && value.trim()) creds[field.key] = value.trim();
        }
        if (isSmtp) {
          const existing = await prisma.integration.findUnique({
            where: { userId_provider: { userId, provider: "smtp" } },
          });
          if (existing) {
            try {
              const old = decryptJson<Record<string, string>>(existing.dataEnc);
              if (!creds.password && old.password) creds.password = old.password;
            } catch {
              /* ignora */
            }
          }
          if (!creds.password) return { ok: false, error: "Senha SMTP obrigatória" };
          if (testConnection) {
            const test = await verifySmtpCredentials(creds, creds.preset);
            if (!test.ok) return { ok: false, error: test.message };
          }
        }
        await prisma.integration.upsert({
          where: { userId_provider: { userId, provider } },
          create: { userId, provider, dataEnc: encryptJson(creds) },
          update: { dataEnc: encryptJson(creds) },
        });
        return { ok: true, data: { connected: provider } };
      }

      case "disconnect_integration": {
        const provider = String(input.provider);
        await prisma.integration.deleteMany({ where: { userId, provider } });
        return { ok: true, data: { disconnected: provider } };
      }

      case "create_api_key": {
        const { raw, hash, prefix } = generateApiKey();
        const row = await prisma.apiKey.create({
          data: {
            userId,
            name: input.name ? String(input.name) : "Assistente",
            keyHash: hash,
            keyPrefix: prefix,
          },
        });
        return {
          ok: true,
          data: {
            id: row.id,
            key: raw,
            prefix,
            warning: "Copie a chave agora — não será exibida novamente.",
          },
        };
      }

      case "revoke_api_key": {
        if (input.key_id) {
          await prisma.apiKey.deleteMany({ where: { id: String(input.key_id), userId } });
        } else {
          await prisma.apiKey.deleteMany({ where: { userId } });
        }
        return { ok: true, data: { revoked: true } };
      }

      case "set_anthropic_key": {
        const key = String(input.api_key).trim();
        if (!key.startsWith("sk-ant-")) return { ok: false, error: "Chave inválida (deve começar com sk-ant-)" };
        await prisma.user.update({ where: { id: userId }, data: { anthropicKey: key } });
        return { ok: true, data: { saved: true } };
      }

      case "remove_anthropic_key": {
        await prisma.user.update({ where: { id: userId }, data: { anthropicKey: null } });
        return { ok: true, data: { removed: true } };
      }

      default:
        return { ok: false, error: `Ferramenta desconhecida: ${name}` };
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
