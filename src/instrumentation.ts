/**
 * Scheduler in-process: a cada 60s chama o endpoint /api/cron/tick, que roda as
 * automações agendadas vencidas. Usamos fetch (em vez de importar o engine) para
 * não arrastar libs Node-only para o bundle da instrumentação.
 *
 * Conveniência para dev/self-host. Em produção serverless, prefira um cron externo
 * apontando para /api/cron/tick e desligue isto com ENABLE_INPROCESS_CRON=false.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.ENABLE_INPROCESS_CRON === "false") return;

  const g = globalThis as unknown as { __automatiteCron?: boolean };
  if (g.__automatiteCron) return;
  g.__automatiteCron = true;

  const base = process.env.APP_URL || "http://localhost:3000";
  const secret = process.env.CRON_SECRET;

  const tick = async () => {
    try {
      const res = await fetch(`${base}/api/cron/tick`, {
        method: "POST",
        headers: secret ? { "x-cron-secret": secret } : {},
      });
      await res.json().catch(() => ({}));
    } catch {
      // servidor pode ainda não estar pronto no primeiro tick — ignora
    }
  };

  setTimeout(tick, 5000);
  setInterval(tick, 60_000);
}
