import { createId } from "@/lib/id";
import { normalizeUsername, accountId } from "./platforms";
import type { AccountSnapshot, CompletenessStatus, DataSource, DataWarning, Platform, RelationEntry } from "./types";

export const DAY_MS = 24 * 60 * 60 * 1000;
/** A partir de esta diferencia entre listas se pide confirmación expresa. */
export const LIST_DATE_GAP_CONFIRM_DAYS = 7;
/** A partir de esta diferencia la comparación se marca como parcial. */
export const LIST_DATE_GAP_PARTIAL_DAYS = 30;
/** Exportaciones más antiguas que esto generan un aviso. */
export const OLD_EXPORT_DAYS = 60;

export interface BuildSnapshotInput {
  platform: Platform;
  ownerUsername: string;
  source: DataSource;
  followers: RelationEntry[];
  following: RelationEntry[];
  listDates: { followers?: string; following?: string };
  warnings: DataWarning[];
  /** El importador detectó indicios de que alguna lista está truncada o incompleta. */
  incomplete?: boolean;
  now?: Date;
}

export function daysBetween(a: string, b: string): number {
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) / DAY_MS;
}

export function listDateGapDays(listDates: { followers?: string; following?: string }): number | undefined {
  if (!listDates.followers || !listDates.following) return undefined;
  return daysBetween(listDates.followers, listDates.following);
}

export function buildSnapshot(input: BuildSnapshotInput): AccountSnapshot {
  const now = input.now ?? new Date();
  const owner = normalizeUsername(input.platform, input.ownerUsername);
  if (!owner.ok) throw new Error("owner_username_invalid");

  const warnings: DataWarning[] = [...input.warnings];
  let completeness: CompletenessStatus = input.incomplete ? "partial" : "complete";

  const gap = listDateGapDays(input.listDates);
  if (gap !== undefined && gap > LIST_DATE_GAP_CONFIRM_DAYS) {
    warnings.push({
      code: "list_date_gap",
      severity: "warning",
      message: `Las listas de seguidores y seguidos se exportaron con ${Math.round(gap)} días de diferencia. Algunas diferencias pueden deberse a ese desfase.`,
    });
    if (gap > LIST_DATE_GAP_PARTIAL_DAYS) completeness = "partial";
  }

  const dates = [input.listDates.followers, input.listDates.following].filter((d): d is string => Boolean(d));
  // La instantánea corresponde a la lista más antigua: es el momento hasta el que ambas son fiables.
  const capturedAt = dates.length ? dates.sort()[0]! : now.toISOString();
  if (dates.length && (now.getTime() - new Date(capturedAt).getTime()) / DAY_MS > OLD_EXPORT_DAYS) {
    warnings.push({
      code: "old_export",
      severity: "info",
      message: "La exportación tiene más de dos meses. Los resultados reflejan la situación de entonces, no la actual.",
    });
  }

  return {
    id: createId("snap"),
    accountId: accountId(input.platform, owner.key),
    ownerUsername: owner.display,
    platform: input.platform,
    capturedAt,
    source: input.source,
    followers: input.followers,
    following: input.following,
    listDates: input.listDates,
    completenessStatus: completeness,
    validationWarnings: warnings,
  };
}
