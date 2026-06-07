import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { KeySettings } from "@/components/KeySettings";
import { PasswordSettings } from "@/components/PasswordSettings";
import { EmailSettings } from "@/components/EmailSettings";
import { ApiKeySettings } from "@/components/ApiKeySettings";
import { IntegrationsSettings } from "@/components/IntegrationsSettings";
import { isPlatformSmsReady } from "@/lib/platform-services";
import { loadUserIntegrations } from "@/lib/integrations";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [dbUser, integrations, creds, apiKeys] = await Promise.all([
    prisma.user.findUnique({ where: { id: user.id } }),
    prisma.integration.findMany({ where: { userId: user.id }, select: { provider: true } }),
    loadUserIntegrations(user.id),
    prisma.apiKey.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }),
  ]);
  const key = dbUser?.anthropicKey ?? null;
  const keyHint = key ? `${key.slice(0, 12)}…${key.slice(-4)}` : null;
  const connected = integrations.map((i) => i.provider);
  const smtpFrom = creds.smtp?.fromEmail ?? creds.smtp?.user ?? null;
  const h = headers();
  const appOrigin =
    (process.env.APP_URL ?? "").replace(/\/$/, "") ||
    `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host") ?? "localhost:3000"}`;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Configurações</h1>
        <p className="text-sm text-slate-500">Conta: {user.email}</p>
      </div>

      <PasswordSettings />
      <EmailSettings
        isConnected={connected.includes("smtp")}
        fromHint={smtpFrom}
        initial={creds.smtp}
      />
      <ApiKeySettings
        appOrigin={appOrigin}
        keys={apiKeys.map((k) => ({
          id: k.id,
          name: k.name,
          keyPrefix: k.keyPrefix,
          createdAt: k.createdAt.toISOString(),
          lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
        }))}
      />
      <KeySettings hasKey={!!key} keyHint={keyHint} />
      <IntegrationsSettings connected={connected} smsReady={isPlatformSmsReady()} />
    </div>
  );
}
