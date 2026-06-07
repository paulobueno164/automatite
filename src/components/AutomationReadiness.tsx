"use client";

import Link from "next/link";
import { ReadinessResult } from "@/lib/automation-readiness";
import { ACTION_CATALOG } from "@/lib/flow-types";

const KIND_LABEL: Record<string, string> = {
  field: "Campo obrigatório",
  integration: "Integração externa",
  platform: "Recurso da plataforma",
};

export function AutomationReadiness({ readiness }: { readiness: ReadinessResult }) {
  if (readiness.ready) {
    return (
      <div className="card border-green-200 bg-green-50/50">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">Pronta para executar</h2>
            <p className="text-sm text-slate-500">Todos os campos necessários desta automação estão preenchidos.</p>
          </div>
          <span className="badge shrink-0 bg-green-100 text-green-700">100%</span>
        </div>
      </div>
    );
  }

  return (
    <div className="card space-y-4 border-amber-200 bg-amber-50/50">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">Falta configurar {readiness.missingCount} item{readiness.missingCount > 1 ? "s" : ""}</h2>
          <p className="text-sm text-slate-500">
            Só o que <strong>esta automação</strong> usa — não precisa configurar tudo das integrações.
          </p>
        </div>
        <span className="badge shrink-0 bg-amber-100 text-amber-800">Incompleta</span>
      </div>

      <div className="space-y-3">
        {readiness.groups.map((group) => (
          <div key={group.index} className="rounded-lg border border-white bg-white p-3">
            <div className="mb-2 flex items-center gap-2 text-sm">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 text-xs font-semibold text-amber-800">
                {group.index + 1}
              </span>
              <span className="font-medium text-slate-800">{group.label}</span>
              <span className="text-xs text-slate-400">({ACTION_CATALOG[group.actionType]?.title})</span>
            </div>
            <ul className="space-y-1.5">
              {group.items.map((item, i) => (
                <li key={i} className="flex items-start justify-between gap-2 rounded-md bg-slate-50 px-2.5 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-800">{item.requirement}</p>
                    <p className="text-xs text-slate-400">
                      {KIND_LABEL[item.kind]}
                      {item.detail ? ` · ${item.detail}` : ""}
                    </p>
                  </div>
                  {item.fixUrl && (
                    <Link href={item.fixUrl} className="shrink-0 text-xs font-medium text-brand-700 hover:underline">
                      {item.fixLabel ?? "Resolver"}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
