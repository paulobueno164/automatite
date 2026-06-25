import { ACTION_CATALOG, Action, Flow } from "@/lib/flow-types";
import { ACTION_SCHEMAS, formatFieldValue } from "@/lib/action-schemas";

const TRIGGER_LABEL: Record<string, string> = {
  webhook: "Webhook / chamada externa",
  form_submission: "Formulário recebido",
  schedule: "Agendamento",
};

function ActionSummary({ action }: { action: Action }) {
  const schema = ACTION_SCHEMAS[action.type];
  const params = action.params ?? {};
  const visibleFields = schema.fields.filter((f) => {
    const v = params[f.key];
    return v !== undefined && v !== null && String(v).trim() !== "";
  });

  if (visibleFields.length === 0) {
    return <p className="text-xs text-slate-400 italic">Sem parâmetros configurados</p>;
  }

  return (
    <dl className="mt-2 space-y-1.5">
      {visibleFields.map((field) => (
        <div key={field.key} className="grid grid-cols-[minmax(0,110px)_1fr] gap-2 text-xs">
          <dt className="text-slate-400">{field.label}</dt>
          <dd className="truncate font-medium text-slate-700" title={String(params[field.key] ?? "")}>
            {formatFieldValue(field, params[field.key])}
          </dd>
        </div>
      ))}
      {action.type === "loop" && Array.isArray(params.actions) && (
        <div className="mt-2 border-l-2 border-brand-200 pl-3">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1">Ações do Loop</p>
          <ol className="space-y-2">
            {params.actions.map((subAction: Action, si: number) => (
              <li key={si} className="text-xs">
                <span className="font-medium text-slate-600">{si + 1}.</span> {subAction.label || ACTION_CATALOG[subAction.type]?.title || subAction.type}
              </li>
            ))}
          </ol>
        </div>
      )}
    </dl>
  );
}

export function FlowPreview({ flow }: { flow: Flow }) {
  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-lg font-semibold">{flow.name}</h3>
        {flow.description && <p className="text-sm text-slate-500">{flow.description}</p>}
      </div>

      <div className="rounded-lg border border-dashed border-brand-300 bg-brand-50 p-3 text-sm">
        <span className="badge bg-brand-100 text-brand-700">Gatilho</span>{" "}
        <span className="font-medium">{TRIGGER_LABEL[flow.trigger.type] ?? flow.trigger.type}</span>
      </div>

      <ol className="space-y-2">
        {flow.actions.map((action, i) => (
          <li key={i} className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-3">
            <span className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{action.label || ACTION_CATALOG[action.type]?.title || action.type}</p>
              <p className="text-xs text-slate-400">{ACTION_CATALOG[action.type]?.title ?? action.type}</p>
              <ActionSummary action={action} />
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
