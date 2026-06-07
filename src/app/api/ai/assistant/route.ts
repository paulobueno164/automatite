import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { runAssistantChat, ChatMessage } from "@/lib/ai-assistant/chat";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json();
  const messages: ChatMessage[] = Array.isArray(body.messages) ? body.messages : [];
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  if (!lastUser?.content?.trim() && !body.confirmedTool) {
    return NextResponse.json({ error: "Mensagem vazia" }, { status: 400 });
  }

  const h = headers();
  const appOrigin =
    (process.env.APP_URL ?? "").replace(/\/$/, "") ||
    `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host") ?? "localhost:3000"}`;

  const dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: { anthropicKey: true } });

  if (body.confirmedTool?.name && body.confirmedTool?.input) {
    if (body.executeOnly) {
      const { executeAssistantTool } = await import("@/lib/ai-assistant/execute");
      const { TOOL_MAP } = await import("@/lib/ai-assistant/tools");
      const result = await executeAssistantTool(
        user.id,
        user.email,
        body.confirmedTool.name,
        body.confirmedTool.input,
        appOrigin
      );
      if (!result.ok) {
        return NextResponse.json({ error: result.error, executed: false }, { status: 400 });
      }
      const def = TOOL_MAP.get(body.confirmedTool.name);
      return NextResponse.json({
        executed: true,
        executeOnly: true,
        toolResult: result.data,
        label: def?.confirmLabel?.(body.confirmedTool.input) ?? body.confirmedTool.name,
      });
    }
    const chatResult = await runAssistantChat({
      userId: user.id,
      userEmail: user.email,
      userKey: dbUser?.anthropicKey,
      messages,
      appOrigin,
      confirmedTool: { name: body.confirmedTool.name, input: body.confirmedTool.input },
    });
    return NextResponse.json({ ...chatResult, executed: true });
  }

  const result = await runAssistantChat({
    userId: user.id,
    userEmail: user.email,
    userKey: dbUser?.anthropicKey,
    messages,
    appOrigin,
  });

  return NextResponse.json(result);
}
