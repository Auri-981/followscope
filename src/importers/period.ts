import type { DataWarning, RelationEntry } from "@/domain/types";

/**
 * Detecta exportaciones pedidas para un periodo limitado (p. ej. «Último año»
 * en Instagram). En ese caso la lista de seguidores solo incluye a quienes te
 * siguieron dentro del periodo, mientras que la de seguidos puede remontarse
 * mucho más atrás: los seguidores antiguos aparecerían, por error, como
 * «no te siguen de vuelta».
 *
 * Señal: hay bastantes cuentas que empezaste a seguir mucho antes de la fecha
 * del seguidor más antiguo del archivo. Una cuenta real casi siempre tiene
 * algún seguidor de esa época. Los umbrales son prudentes para no avisar sin motivo.
 */
export const LIMITED_PERIOD_MIN_GAP_DAYS = 60;
export const LIMITED_PERIOD_MIN_OLDER_FOLLOWING = 5;
/** Proporción mínima de registros con fecha para poder aplicar la comprobación. */
const MIN_DATED_RATIO = 0.9;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface LimitedPeriodFinding {
  /** Fecha (ISO) del seguidor más antiguo incluido en el archivo. */
  earliestFollowerAt: string;
  /** Cuentas seguidas antes de esa fecha (con margen). */
  olderFollowingCount: number;
}

function datedRatio(list: readonly RelationEntry[]): number {
  if (list.length === 0) return 0;
  let dated = 0;
  for (const e of list) if (e.since) dated++;
  return dated / list.length;
}

export function detectLimitedPeriod(followers: readonly RelationEntry[], following: readonly RelationEntry[]): LimitedPeriodFinding | undefined {
  if (followers.length === 0 || following.length === 0) return undefined;
  if (datedRatio(followers) < MIN_DATED_RATIO || datedRatio(following) < MIN_DATED_RATIO) return undefined;

  let earliest: string | undefined;
  for (const e of followers) if (e.since && (!earliest || e.since < earliest)) earliest = e.since;
  if (!earliest) return undefined;

  const threshold = new Date(new Date(earliest).getTime() - LIMITED_PERIOD_MIN_GAP_DAYS * DAY_MS).toISOString();
  let older = 0;
  for (const e of following) if (e.since && e.since < threshold) older++;
  if (older < LIMITED_PERIOD_MIN_OLDER_FOLLOWING) return undefined;
  return { earliestFollowerAt: earliest, olderFollowingCount: older };
}

export function limitedPeriodWarning(finding: LimitedPeriodFinding): DataWarning {
  const date = new Date(finding.earliestFollowerAt).toLocaleDateString("es-ES", { dateStyle: "long" });
  return {
    code: "limited_period_export",
    severity: "warning",
    message:
      `Tu lista de seguidores solo incluye cuentas que te siguieron a partir del ${date}, pero sigues a ${finding.olderFollowingCount} cuentas desde antes. ` +
      "Parece que la exportación se pidió para un periodo limitado (por ejemplo, «Último año»): tus seguidores más antiguos no aparecen y saldrían por error en «No te siguen de vuelta». " +
      "Vuelve a pedir la exportación eligiendo «Desde el principio» como intervalo de fechas.",
  };
}
