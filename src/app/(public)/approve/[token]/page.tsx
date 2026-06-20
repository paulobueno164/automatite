import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { ExecutionStep } from "@/lib/flow-types";
import { Check, X, Clock, AlertCircle } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ApprovePage({
  params,
  searchParams
}: {
  params: { token: string };
  searchParams: { success?: string, decision?: string };
}) {
  const isSuccess = searchParams.success === "true";
  const decision = searchParams.decision;

  const execution = await prisma.execution.findFirst({
    where: { resumeToken: params.token, status: "paused" },
    include: { automation: true },
  });

  if (isSuccess || !execution) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
          {isSuccess ? (
            <>
              <div className={`w-12 h-12 ${decision === 'approve' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'} rounded-full flex items-center justify-center mx-auto mb-4`}>
                {decision === 'approve' ? <Check className="w-6 h-6" /> : <X className="w-6 h-6" />}
              </div>
              <h1 className="text-xl font-semibold text-slate-900 mb-2">
                {decision === 'approve' ? 'Aprovado com sucesso!' : 'Execução cancelada.'}
              </h1>
              <p className="text-slate-600">
                {decision === 'approve'
                  ? 'A automação continuará sua execução conforme planejado.'
                  : 'O fluxo foi interrompido e não haverá mais ações.'}
              </p>
            </>
          ) : (
            <>
              <AlertCircle className="w-12 h-12 text-slate-400 mx-auto mb-4" />
              <h1 className="text-xl font-semibold text-slate-900 mb-2">Link expirado ou já processado</h1>
              <p className="text-slate-600">Esta automação já foi concluída ou o link de aprovação não é mais válido.</p>
            </>
          )}
        </div>
      </div>
    );
  }

  const steps: ExecutionStep[] = JSON.parse(execution.logJson);
  const lastStep = steps[steps.length - 1];
  const payload = JSON.parse(execution.inputJson);

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-8 border-b border-slate-100 bg-slate-50/50">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">Aprovação Necessária</h1>
                <p className="text-sm text-slate-500">Automação: {execution.automation.name}</p>
              </div>
            </div>

            <div className="bg-white border border-indigo-100 rounded-xl p-4 text-indigo-900 text-sm">
              <p className="font-medium mb-1">Mensagem do sistema:</p>
              <p>{lastStep?.detail || "Aguardando sua decisão para continuar o fluxo."}</p>
            </div>
          </div>

          <div className="p-8">
            <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-4">Dados da Execução</h2>
            <div className="bg-slate-900 rounded-xl p-4 overflow-auto max-h-64">
              <pre className="text-indigo-300 text-xs leading-relaxed">
                {JSON.stringify(payload, null, 2)}
              </pre>
            </div>
          </div>

          <div className="p-8 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row gap-3">
            <form action={`/api/approve`} method="POST" className="flex-1 flex gap-3 w-full">
                <input type="hidden" name="executionId" value={execution.id} />
                <input type="hidden" name="token" value={params.token} />

                <button
                  name="decision"
                  value="reject"
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-white border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50 transition-colors"
                >
                  <X className="w-5 h-5 text-red-500" />
                  Reprovar
                </button>

                <button
                  name="decision"
                  value="approve"
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-shadow shadow-lg shadow-indigo-200"
                >
                  <Check className="w-5 h-5" />
                  Aprovar e Continuar
                </button>
            </form>
          </div>
        </div>

        <p className="mt-6 text-center text-slate-400 text-xs">
          Automatite &copy; {new Date().getFullYear()} — Automação Segura com IA
        </p>
      </div>
    </div>
  );
}
