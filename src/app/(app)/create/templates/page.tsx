import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { TEMPLATES } from "@/lib/templates";
import { FlowPreview } from "@/components/FlowPreview";
import { UseTemplateButton } from "@/components/UseTemplateButton";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  if (!(await getCurrentUser())) redirect("/login");
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Templates prontos</h1>
          <p className="text-sm text-slate-500">Escolha um fluxo e personalize depois.</p>
        </div>
        <Link href="/create" className="btn-ghost">
          ← Voltar
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {TEMPLATES.map((t) => (
          <div key={t.id} className="card flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{t.emoji}</span>
              <span className="badge bg-slate-100 text-slate-600">{t.segment}</span>
            </div>
            <FlowPreview flow={t.flow} />
            <div className="mt-auto pt-2">
              <UseTemplateButton flow={t.flow} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
