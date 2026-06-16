import { NextRequest, NextResponse } from "next/server";
import { runAutomation, ExecutionLimitError } from "@/lib/engine";
import { getCurrentUser } from "@/lib/auth";

type Params = { params: { id: string } };

/**
 * POST /api/trigger/[id] — endpoint PÚBLICO que dispara uma automação.
 * Não exige login (é aqui que formulários/webhooks externos batem), mas
 * respeita os limites do plano do dono da automação.
 * O corpo da requisição (JSON) vira o payload usado nos placeholders {campo}.
 */
export async function POST(req: NextRequest, { params }: Params) {
  let payload: Record<string, unknown> = {};
  try {
    payload = await req.json();
  } catch {
    payload = {};
  }

  try {
    const result = await runAutomation(params.id, payload);

    // Sentinel Protection: Filter steps if requester is not the owner (prevents secrets leakage).
    const user = await getCurrentUser();
    if (user?.id !== result.userId) {
      const { steps, ...safeResult } = result;
      return NextResponse.json(safeResult);
    }

    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ExecutionLimitError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 402 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 400 }
    );
  }
}
