import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { decryptJson, encryptJson } from "@/lib/crypto";
import { getProvider } from "@/lib/integrations";
import { verifySmtpCredentials } from "@/lib/smtp-verify";

// GET /api/integrations — lista os providers conectados (apenas os ids)
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const rows = await prisma.integration.findMany({
    where: { userId: user.id },
    select: { provider: true, updatedAt: true },
  });
  return NextResponse.json(rows);
}

// POST /api/integrations — conecta/atualiza um provider { provider, data: {...} }
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { provider, data, testConnection = true } = await req.json();
  const def = getProvider(provider);
  if (!def) return NextResponse.json({ error: "Provider inválido" }, { status: 400 });

  const creds: Record<string, string> = {};
  const isSmtpUpdate = provider === "smtp";
  for (const field of def.fields) {
    const value = data?.[field.key];
    const skipRequired = isSmtpUpdate && field.key === "password";
    if (!field.optional && !skipRequired && (typeof value !== "string" || !value.trim())) {
      return NextResponse.json({ error: `Campo obrigatório: ${field.label}` }, { status: 400 });
    }
    if (typeof value === "string" && value.trim()) creds[field.key] = value.trim();
  }

  if (provider === "smtp") {
    const existing = await prisma.integration.findUnique({
      where: { userId_provider: { userId: user.id, provider: "smtp" } },
    });
    if (existing) {
      try {
        const old = decryptJson<Record<string, string>>(existing.dataEnc);
        if (testConnection === false) {
          for (const [key, value] of Object.entries(old)) {
            if (!creds[key] && value) creds[key] = value;
          }
        } else if (!creds.password && old.password) {
          creds.password = old.password;
        }
      } catch {
        /* ignora */
      }
    }
    if (!creds.password) {
      return NextResponse.json({ error: "Informe a senha ou senha de app do seu e-mail." }, { status: 400 });
    }
    if (!creds.host || !creds.user || !creds.fromEmail) {
      return NextResponse.json({ error: "Preencha servidor SMTP, e-mail e remetente." }, { status: 400 });
    }

    const skipTest = testConnection === false && existing;
    if (!skipTest) {
      const test = await verifySmtpCredentials(creds, creds.preset);
      if (!test.ok) {
        return NextResponse.json({ error: test.message, hint: test.hint }, { status: 400 });
      }
    }
  }

  // Validação extra: service account do Google precisa ser JSON válido.
  if (provider === "google_sheets") {
    try {
      const sa = JSON.parse(creds.serviceAccountJson);
      if (!sa.client_email || !sa.private_key) throw new Error();
    } catch {
      return NextResponse.json({ error: "Service Account JSON inválido (precisa de client_email e private_key)." }, { status: 400 });
    }
  }

  await prisma.integration.upsert({
    where: { userId_provider: { userId: user.id, provider } },
    create: { userId: user.id, provider, dataEnc: encryptJson(creds) },
    update: { dataEnc: encryptJson(creds) },
  });
  return NextResponse.json({ ok: true });
}

// DELETE /api/integrations?provider=xxx — desconecta
export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const provider = req.nextUrl.searchParams.get("provider") ?? "";
  await prisma.integration.deleteMany({ where: { userId: user.id, provider } });
  return NextResponse.json({ ok: true });
}
