import { PLATFORM_SERVICES } from "@/lib/platform-services";

export function PlatformServicesPanel({ smsReady }: { smsReady: boolean }) {
  return (
    <div className="space-y-3">
      <div>
        <h2 className="font-semibold">Já incluso na sua conta</h2>
        <p className="text-sm text-slate-500">
          Esses recursos funcionam sem conectar ferramentas externas. Configure seu e-mail na seção acima.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {PLATFORM_SERVICES.map((s) => (
          <div key={s.id} className="card flex items-start gap-3">
            <span className="text-2xl">{s.emoji}</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">{s.name}</span>
                <span className="badge bg-green-100 text-green-700">Ativo</span>
              </div>
              <p className="mt-1 text-xs text-slate-500">{s.description}</p>
            </div>
          </div>
        ))}
        <div className="card flex items-start gap-3">
          <span className="text-2xl">📱</span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-medium">SMS</span>
              <span className={`badge ${smsReady ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                {smsReady ? "Ativo" : "Em breve"}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500">Confirmações por SMS — incluso na plataforma.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
