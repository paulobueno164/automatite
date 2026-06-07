import { NextRequest, NextResponse } from "next/server";
import { runDueSchedules } from "@/lib/engine";

export const dynamic = "force-dynamic";

/**
 * POST/GET /api/cron/tick — dispara as automações agendadas que estão vencidas.
 * Protegido por CRON_SECRET (header x-cron-secret ou ?secret=). Se CRON_SECRET
 * não estiver setado, o endpoint fica aberto (conveniência de dev).
 *
 * Aponte um cron externo (ex.: cron-job.org, GitHub Actions, Vercel Cron) para
 * este endpoint a cada minuto. Em dev, o scheduler in-process já chama isto sozinho.
 */
async function handle(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const provided = req.headers.get("x-cron-secret") ?? req.nextUrl.searchParams.get("secret");
    if (provided !== secret) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
  }
  const result = await runDueSchedules();
  return NextResponse.json({ ok: true, ...result });
}

export const POST = handle;
export const GET = handle;
