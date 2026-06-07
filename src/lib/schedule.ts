import { CronExpressionParser } from "cron-parser";

export type CronPreset = { value: string; label: string };

/** Presets prontos para o usuário escolher sem saber sintaxe cron. */
export const CRON_PRESETS: CronPreset[] = [
  { value: "*/5 * * * *", label: "A cada 5 minutos" },
  { value: "0 * * * *", label: "A cada hora (no minuto 0)" },
  { value: "0 9 * * *", label: "Todo dia às 9h" },
  { value: "0 18 * * *", label: "Todo dia às 18h" },
  { value: "0 9 * * 1", label: "Toda segunda às 9h" },
  { value: "0 9 1 * *", label: "Todo dia 1º do mês às 9h" },
];

const DEFAULT_TZ = "America/Sao_Paulo";

/**
 * Calcula a próxima execução a partir de `from` (default: agora) para a expressão cron.
 * Retorna null se a expressão for inválida.
 */
export function computeNextRun(cron: string, from: Date = new Date(), tz: string = DEFAULT_TZ): Date | null {
  try {
    const interval = CronExpressionParser.parse(cron, { currentDate: from, tz });
    return interval.next().toDate();
  } catch {
    return null;
  }
}

export function isValidCron(cron: string): boolean {
  return computeNextRun(cron) !== null;
}

/** Descrição amigável: usa o label do preset, ou mostra a própria expressão. */
export function describeCron(cron: string): string {
  const preset = CRON_PRESETS.find((p) => p.value === cron);
  return preset ? preset.label : `cron: ${cron}`;
}
