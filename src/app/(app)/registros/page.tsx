import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function RegistrosPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const records = await prisma.record.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const labels = [...new Set(records.map((r) => r.label))];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Registros</h1>
        <p className="text-sm text-slate-500">
          Leads e respostas salvos pelas suas automações — sem precisar de planilha.
        </p>
      </div>

      {labels.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {labels.map((label) => (
            <span key={label} className="badge bg-slate-100 text-slate-600">
              {label} ({records.filter((r) => r.label === label).length})
            </span>
          ))}
        </div>
      )}

      {records.length === 0 ? (
        <div className="card text-center text-sm text-slate-400">
          Nenhum registro ainda. Use uma automação com a ação &quot;Salvar em Registros&quot; para começar.
        </div>
      ) : (
        <div className="space-y-2">
          {records.map((rec) => {
            const data = JSON.parse(rec.dataJson) as Record<string, unknown>;
            const preview = Object.entries(data)
              .filter(([k]) => !k.startsWith("_"))
              .slice(0, 4)
              .map(([k, v]) => `${k}: ${v}`)
              .join(" · ");
            return (
              <details key={rec.id} className="card">
                <summary className="flex cursor-pointer items-center justify-between gap-2 text-sm">
                  <span className="font-medium">{preview || "(sem dados)"}</span>
                  <span className="shrink-0 text-xs text-slate-400">
                    <span className="badge bg-brand-50 text-brand-700 mr-2">{rec.label}</span>
                    {new Date(rec.createdAt).toLocaleString("pt-BR")}
                  </span>
                </summary>
                <pre className="mt-3 overflow-x-auto rounded bg-slate-50 p-3 text-xs text-slate-600">
                  {JSON.stringify(data, null, 2)}
                </pre>
              </details>
            );
          })}
        </div>
      )}
    </div>
  );
}
