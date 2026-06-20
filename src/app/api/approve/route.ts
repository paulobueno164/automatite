import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resumeAutomation } from "@/lib/engine";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "Token ausente" }, { status: 400 });
  }

  try {
    const execution = await prisma.execution.findUnique({
      where: { resumeToken: token },
      include: { automation: true }
    });

    if (!execution) {
      return new NextResponse("Link de aprovação inválido ou já utilizado.", { status: 404 });
    }

    // Renderiza uma página de confirmação simples para evitar gatilhos acidentais por scanners de e-mail
    return new NextResponse(`
      <html>
        <head>
          <title>Aprovação - Automatite</title>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <script src="https://cdn.tailwindcss.com"></script>
        </head>
        <body class="bg-slate-50 flex items-center justify-center min-h-screen p-4">
          <div class="bg-white p-8 rounded-xl shadow-sm border border-slate-200 max-w-md w-full text-center">
            <h1 class="text-xl font-bold text-slate-900 mb-2">Confirmar Aprovação</h1>
            <p class="text-slate-600 mb-6 text-sm">Você está prestes a aprovar a execução da automação: <br><strong>${execution.automation.name}</strong></p>

            <form action="/api/approve" method="POST">
                <input type="hidden" name="token" value="${token}">
                <button type="submit" class="w-full bg-brand-600 text-white rounded-lg px-4 py-2 font-medium hover:bg-brand-700 transition-colors bg-[#635BFF]">
                    Sim, aprovar agora
                </button>
            </form>

            <p class="mt-4 text-xs text-slate-400">Se você não solicitou isso, ignore este e-mail.</p>
          </div>
        </body>
      </html>
    `, { headers: { "Content-Type": "text/html" } });
  } catch (err) {
    console.error("Erro ao carregar página de aprovação:", err);
    return new NextResponse("Erro ao processar.", { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const token = formData.get("token")?.toString();

  if (!token) {
    return NextResponse.json({ error: "Token ausente" }, { status: 400 });
  }

  try {
    const execution = await prisma.execution.findUnique({
      where: { resumeToken: token },
    });

    if (!execution) {
      return new NextResponse("Link inválido ou já utilizado.", { status: 404 });
    }

    await resumeAutomation(execution.id, token);

    return new NextResponse(`
      <html>
        <head>
          <title>Sucesso - Automatite</title>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <script src="https://cdn.tailwindcss.com"></script>
        </head>
        <body class="bg-slate-50 flex items-center justify-center min-h-screen p-4">
          <div class="bg-white p-8 rounded-xl shadow-sm border border-slate-200 max-w-md w-full text-center">
            <div class="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 class="text-2xl font-bold text-slate-900 mb-2">Aprovado!</h1>
            <p class="text-slate-600 mb-6">A automação foi retomada com sucesso.</p>
            <p class="text-sm text-slate-400">Você já pode fechar esta janela.</p>
          </div>
        </body>
      </html>
    `, { headers: { "Content-Type": "text/html" } });
  } catch (err) {
    console.error("Erro ao aprovar:", err);
    return new NextResponse("Erro ao processar aprovação.", { status: 500 });
  }
}
