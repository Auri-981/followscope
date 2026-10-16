import { accountId, normalizeUsername, platformRules, sanitizeProfileUrl } from "./platforms";
import type { DataWarning, Platform, RelationEntry } from "./types";

/** Registro en bruto tal y como lo entrega un importador o adaptador. */
export interface RawAccountRecord {
  username: unknown;
  displayName?: unknown;
  profileUrl?: unknown;
  /** Fecha ISO de inicio de la relación, si se conoce. */
  since?: string;
}

export interface NormalizedList {
  entries: RelationEntry[];
  /** Registros recibidos antes de normalizar. */
  rawCount: number;
  duplicateCount: number;
  invalidCount: number;
  unusualCount: number;
  warnings: DataWarning[];
}

/**
 * Normaliza una lista de cuentas: limpia nombres, elimina duplicados por clave
 * estable (conservando el primer nombre original y completando datos ausentes)
 * y descarta registros sin nombre de usuario utilizable. Coste O(n).
 */
export function normalizeAccountList(platform: Platform, records: readonly RawAccountRecord[]): NormalizedList {
  const byKey = new Map<string, RelationEntry>();
  let duplicateCount = 0;
  let invalidCount = 0;
  let unusualCount = 0;

  for (const record of records) {
    const check = normalizeUsername(platform, record.username);
    if (!check.ok) {
      invalidCount++;
      continue;
    }
    const id = accountId(platform, check.key);
    const displayName = typeof record.displayName === "string" ? record.displayName.trim() || undefined : undefined;
    const profileUrl = sanitizeProfileUrl(platform, record.profileUrl);
    const existing = byKey.get(id);
    if (existing) {
      duplicateCount++;
      if (!existing.displayName && displayName) existing.displayName = displayName;
      if (!existing.profileUrl && profileUrl) existing.profileUrl = profileUrl;
      if (record.since && (!existing.since || record.since < existing.since)) existing.since = record.since;
      continue;
    }
    if (check.unusual) unusualCount++;
    const entry: RelationEntry = {
      id,
      platform,
      username: check.display,
      // Si la exportación no trae URL, se construye con el patrón canónico de la plataforma.
      profileUrl: profileUrl ?? platformRules[platform].buildProfileUrl(check.key),
    };
    if (displayName) entry.displayName = displayName;
    if (record.since) entry.since = record.since;
    byKey.set(id, entry);
  }

  const warnings: DataWarning[] = [];
  if (duplicateCount > 0) {
    warnings.push({
      code: "duplicates_removed",
      severity: "info",
      message: `Se han encontrado ${duplicateCount} registro(s) duplicado(s); cada cuenta se cuenta una sola vez.`,
    });
  }
  if (invalidCount > 0) {
    warnings.push({
      code: "invalid_records",
      severity: "warning",
      message: `${invalidCount} registro(s) no tenían un nombre de usuario utilizable y se han ignorado.`,
    });
  }
  if (unusualCount > 0) {
    warnings.push({
      code: "unusual_usernames",
      severity: "info",
      message: `${unusualCount} nombre(s) de usuario tienen un formato poco habitual para ${platformRules[platform].label}. Se han conservado tal cual.`,
    });
  }

  return {
    entries: [...byKey.values()],
    rawCount: records.length,
    duplicateCount,
    invalidCount,
    unusualCount,
    warnings,
  };
}
