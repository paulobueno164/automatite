import "server-only";
import { prisma } from "./db";
import { ReadinessContext } from "./automation-readiness";
import { isPlatformEmailReady, isPlatformSmsReady } from "./platform-services";
import { loadUserIntegrations } from "./integrations";

/** Monta o contexto de prontidão para um usuário (integrações + chaves da plataforma). */
export async function buildReadinessContext(userId: string): Promise<ReadinessContext> {
  const [integrationRows, user, creds] = await Promise.all([
    prisma.integration.findMany({ where: { userId }, select: { provider: true } }),
    prisma.user.findUnique({ where: { id: userId }, select: { anthropicKey: true } }),
    loadUserIntegrations(userId),
  ]);

  return {
    connectedProviders: integrationRows.map((i) => i.provider),
    hasPlatformResend: isPlatformEmailReady(),
    hasPlatformSms: isPlatformSmsReady(),
    hasUserAnthropicKey: !!user?.anthropicKey,
    hasPlatformAnthropicKey: !!process.env.ANTHROPIC_API_KEY,
    integrationHints: {
      trelloHasDefaultList: !!creds.trello?.defaultListId,
      asanaHasDefaultProject: !!creds.asana?.defaultProjectId,
      sheetsHasDefaultSpreadsheet: !!creds.google_sheets?.spreadsheetId,
    },
  };
}
