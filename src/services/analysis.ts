import { compareSnapshot, countsOf, dedupeWarnings } from "@/domain/compare";
import { buildSnapshot, listDateGapDays, LIST_DATE_GAP_CONFIRM_DAYS } from "@/domain/snapshot";
import type { AccountSnapshot, AnalysisRecord, ComparisonResult, DataWarning } from "@/domain/types";
import { createId } from "@/lib/id";
import type { SocialDataProvider } from "@/providers/types";

export const LOCAL_SPACE_ID = "local";

export interface AnalysisBundle {
  snapshot: AccountSnapshot;
  result: ComparisonResult;
  record: AnalysisRecord;
}

export type AnalysisFailure =
  | { ok: false; code: "unsupported"; message: string }
  | { ok: false; code: "provider_error"; message: string }
  | { ok: false; code: "date_gap_needs_confirmation"; message: string; gapDays: number }
  | { ok: false; code: "invalid_owner"; message: string };

export interface RunAnalysisOptions {
  /** El usuario confirmó que acepta comparar listas de fechas muy distintas. */
  confirmDateGap?: boolean;
  ownerSpaceId?: string;
  signal?: AbortSignal;
  extraWarnings?: DataWarning[];
  now?: Date;
}

/**
 * Orquesta un análisis completo usando cualquier `SocialDataProvider`:
 * obtiene perfil y listas, construye la instantánea y ejecuta el motor de
 * comparación. No sabe nada de archivos ni de la interfaz.
 */
export async function runAnalysis(
  provider: SocialDataProvider,
  options: RunAnalysisOptions = {},
): Promise<{ ok: true; bundle: AnalysisBundle } | AnalysisFailure> {
  const profile = await provider.getAccountProfile();
  if (profile.status !== "ok") {
    return profile.status === "unsupported"
      ? { ok: false, code: "unsupported", message: profile.reason }
      : { ok: false, code: "invalid_owner", message: profile.message };
  }
  const [followers, following] = await Promise.all([provider.getFollowers(options.signal), provider.getFollowing(options.signal)]);
  for (const res of [followers, following]) {
    if (res.status === "unsupported") return { ok: false, code: "unsupported", message: res.reason };
    if (res.status === "error") return { ok: false, code: "provider_error", message: res.message };
  }
  if (followers.status !== "ok" || following.status !== "ok") {
    return { ok: false, code: "provider_error", message: "No se han podido obtener las listas." };
  }

  const listDates = { followers: followers.data.metadata.capturedAt, following: following.data.metadata.capturedAt };
  const gap = listDateGapDays(listDates);
  if (gap !== undefined && gap > LIST_DATE_GAP_CONFIRM_DAYS && !options.confirmDateGap) {
    return {
      ok: false,
      code: "date_gap_needs_confirmation",
      gapDays: Math.round(gap),
      message: `Las listas se exportaron con ${Math.round(gap)} días de diferencia. Confirma que quieres compararlas igualmente.`,
    };
  }

  const snapshot = buildSnapshot({
    platform: provider.platform,
    ownerUsername: profile.data.username,
    source: followers.data.metadata.source,
    followers: followers.data.entries,
    following: following.data.entries,
    listDates,
    warnings: dedupeWarnings([
      ...(options.extraWarnings ?? []),
      ...followers.data.metadata.warnings,
      ...following.data.metadata.warnings,
    ]),
    incomplete: !followers.data.metadata.complete || !following.data.metadata.complete,
    now: options.now,
  });
  const result = compareSnapshot(snapshot, options.now);
  const record = recordFor(snapshot, result, options.ownerSpaceId ?? LOCAL_SPACE_ID, options.now);
  return { ok: true, bundle: { snapshot, result, record } };
}

export function recordFor(
  snapshot: AccountSnapshot,
  result: ComparisonResult,
  ownerSpaceId: string = LOCAL_SPACE_ID,
  now: Date = new Date(),
): AnalysisRecord {
  return {
    id: createId("an"),
    ownerSpaceId,
    platform: snapshot.platform,
    accountUsername: snapshot.ownerUsername,
    createdAt: now.toISOString(),
    source: snapshot.source,
    completenessStatus: snapshot.completenessStatus,
    isComplete: result.isComplete,
    counts: countsOf(result),
    warnings: result.warnings,
    snapshot,
  };
}

/** Copia del registro sin las listas (opción «guardar solo el resumen»). */
export function summaryOnly(record: AnalysisRecord): AnalysisRecord {
  const { snapshot: _snapshot, ...rest } = record;
  void _snapshot;
  return rest;
}
