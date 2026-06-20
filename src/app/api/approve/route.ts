import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resumeExecution } from "@/lib/engine";

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";
    let executionId: string;
    let token: string;
    let decision: string;

    if (contentType.includes("application/json")) {
      const body = await req.json();
      executionId = body.executionId;
      token = body.token;
      decision = body.decision;
    } else {
      const formData = await req.formData();
      executionId = formData.get("executionId") as string;
      token = formData.get("token") as string;
      decision = formData.get("decision") as string;
    }

    if (!executionId || !token || !decision) {
      return NextResponse.json({ error: "Parâmetros ausentes" }, { status: 400 });
    }

    if (decision !== "approve" && decision !== "reject") {
      return NextResponse.json({ error: "Decisão inválida" }, { status: 400 });
    }

    const result = await resumeExecution(executionId, token, decision);

    if (contentType.includes("application/json")) {
      return NextResponse.json({ ok: true, status: result.status });
    }

    // Redirect for standard form submissions
    return NextResponse.redirect(new URL(`/approve/${token}?success=true&decision=${decision}`, req.url));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
