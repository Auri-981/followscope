import type { RawAccountRecord } from "@/domain/normalize";
import { platformSchema, type Platform } from "@/domain/types";
import { parseCsv } from "./csv";
import { isPlainObject } from "./json";
import { baseName, dateStringToIso } from "./text";
import { ImportError, type DetectedList, type ListKind, type TextEntry } from "./types";

/**
 * Formatos propios de FollowScope (no son formatos oficiales de ninguna red):
 *
 * 1. CSV de lista: columnas `username` (obligatoria), `display_name`,
 *    `profile_url`, `list` (followers | following) y `platform`, opcionales.
 *    Se aceptan encabezados en español (usuario, nombre, enlace, lista…).
 *    Sin columna `list`, el tipo se deduce del nombre del archivo o lo elige el usuario.
 * 2. JSON completo de resultados exportado por FollowScope («todas»): se
 *    reconstruyen las listas a partir de las categorías (mutuo → ambas listas…).
 *    Los CSV de resultados y las exportaciones parciales se rechazan, porque
 *    pueden estar filtrados y darían un análisis falso.
 * 3. Lista simple: un nombre de usuario por línea (TXT/CSV de una columna).
 */

export const FOLLOWSCOPE_RESULTS_FORMAT = "followscope.results";

const HEADER_ALIASES: Record<"username" | "displayName" | "profileUrl" | "list" | "category" | "platform" | "since", string[]> = {
  username: ["username", "user", "usuario", "nombre_de_usuario", "nombre de usuario", "handle", "uniqueid", "cuenta"],
  displayName: ["display_name", "displayname", "name", "full_name", "nombre", "nombre_visible", "nombre visible"],
  profileUrl: ["profile_url", "url", "link", "enlace", "enlace_perfil", "perfil"],
  list: ["list", "lista", "type", "tipo", "kind"],
  category: ["category", "categoria", "categoría", "category_code"],
  platform: ["platform", "plataforma"],
  since: ["since", "date", "fecha", "desde"],
};

function headerIndex(header: string[], aliases: string[]): number {
  return header.findIndex((h) => aliases.includes(h.trim().toLowerCase()));
}

export function kindFromValue(value: string | undefined): ListKind | undefined {
  const v = (value ?? "").trim().toLowerCase();
  if (["followers", "follower", "seguidores", "seguidor", "fans"].includes(v)) return "followers";
  if (["following", "seguidos", "seguido", "siguiendo"].includes(v)) return "following";
  return undefined;
}

export function kindFromFileName(path: string): ListKind | undefined {
  const name = baseName(path).toLowerCase();
  if (/following|seguidos|siguiendo/.test(name)) return "following";
  if (/followers|seguidores|fans/.test(name)) return "followers";
  return undefined;
}

/** Categoría exportada por FollowScope → listas a las que pertenece la cuenta. */
function listsForCategory(value: string): ListKind[] | undefined {
  const v = value.trim().toLowerCase();
  if (v === "mutualfollows" || v === "mutual") return ["followers", "following"];
  if (v === "notfollowingback" || v === "not_following_back") return ["following"];
  if (v === "followsyouonly" || v === "follows_you_only") return ["followers"];
  return undefined;
}

function assertPlatform(entry: TextEntry, found: string | undefined, expected: Platform): void {
  if (!found) return;
  const parsed = platformSchema.safeParse(found.trim().toLowerCase());
  if (parsed.success && parsed.data !== expected) {
    throw new ImportError(
      "wrong_platform",
      `«${entry.displayName}» contiene datos de ${parsed.data === "instagram" ? "Instagram" : "TikTok"}. Impórtalo en la sección correspondiente.`,
    );
  }
}

function buildLists(
  entry: TextEntry,
  format: string,
  rows: { record: RawAccountRecord; kinds: ListKind[] | undefined }[],
): DetectedList[] {
  const fallback = kindFromFileName(entry.path);
  const buckets = new Map<ListKind | "unknown", RawAccountRecord[]>();
  for (const { record, kinds } of rows) {
    for (const kind of kinds ?? [fallback ?? "unknown"]) {
      const bucket = buckets.get(kind) ?? [];
      bucket.push(record);
      buckets.set(kind, bucket);
    }
  }
  if (buckets.size === 0) buckets.set(fallback ?? "unknown", []);
  return [...buckets].map(([kind, records]) => ({
    fileName: buckets.size > 1 ? `${entry.displayName} (${kind === "followers" ? "seguidores" : kind === "following" ? "seguidos" : "sin tipo"})` : entry.displayName,
    kind,
    format,
    records,
    fileDate: entry.fileDate,
    warnings: [],
  }));
}

export function parseGenericCsv(entry: TextEntry, platform: Platform): DetectedList[] {
  const rows = parseCsv(entry.text, entry.displayName);
  if (rows.length === 0) throw new ImportError("file_empty", `«${entry.displayName}» está vacío.`);
  const header = rows[0]!.map((h) => h.trim().toLowerCase());
  const idx = {
    username: headerIndex(header, HEADER_ALIASES.username),
    displayName: headerIndex(header, HEADER_ALIASES.displayName),
    profileUrl: headerIndex(header, HEADER_ALIASES.profileUrl),
    list: headerIndex(header, HEADER_ALIASES.list),
    category: headerIndex(header, HEADER_ALIASES.category),
    platform: headerIndex(header, HEADER_ALIASES.platform),
    since: headerIndex(header, HEADER_ALIASES.since),
  };

  if (idx.username < 0) {
    // Sin encabezado reconocible: se admite una lista simple de una sola columna.
    if (rows.every((r) => r.filter((c) => c.trim()).length <= 1)) {
      return buildLists(entry, "Lista simple de usuarios", rows.map((r) => ({ record: { username: r[0] }, kinds: undefined })));
    }
    throw new ImportError(
      "missing_username_field",
      `«${entry.displayName}» no tiene una columna de nombre de usuario. Añade un encabezado «username» o usa la plantilla de FollowScope.`,
    );
  }

  const body = rows.slice(1);
  const width = header.length;
  if (body.some((r) => r.length > width + 1)) {
    throw new ImportError("malformed_csv", `«${entry.displayName}» tiene filas con más columnas que el encabezado.`);
  }
  if (idx.platform >= 0) assertPlatform(entry, body.find((r) => r[idx.platform]?.trim())?.[idx.platform], platform);

  if (idx.category >= 0) {
    // Un CSV de resultados puede contener solo una categoría o estar filtrado:
    // reconstruir las listas a partir de él daría un análisis falso.
    throw new ImportError(
      "unknown_structure",
      `«${entry.displayName}» es un archivo de resultados, no una lista de seguidores o seguidos. Para volver a cargar un análisis, importa la exportación JSON completa («todas»).`,
    );
  }
  const parsed = body.map((r) => {
    const cell = (i: number) => (i >= 0 ? unescapeFormula(r[i]) : undefined);
    const record: RawAccountRecord = {
      username: cell(idx.username),
      displayName: cell(idx.displayName),
      profileUrl: cell(idx.profileUrl),
      since: dateStringToIso(cell(idx.since)),
    };
    const kind = kindFromValue(cell(idx.list));
    return { record, kinds: kind ? [kind] : undefined };
  });
  return buildLists(entry, "Lista CSV", parsed);
}

/** Revierte la protección contra fórmulas que aplica la exportación CSV ('=…). */
function unescapeFormula(value: string | undefined): string | undefined {
  return value && /^'[=+\-@\t\r]/.test(value) ? value.slice(1) : value;
}

export function parseSimpleList(entry: TextEntry): DetectedList[] {
  const lines = entry.text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) throw new ImportError("file_empty", `«${entry.displayName}» está vacío.`);
  return buildLists(entry, "Lista simple de usuarios", lines.map((l) => ({ record: { username: l }, kinds: undefined })));
}

function recordFromJson(item: unknown): RawAccountRecord {
  if (typeof item === "string") return { username: item };
  if (!isPlainObject(item)) return { username: undefined };
  return {
    username: item.username ?? item.usuario,
    displayName: item.displayName ?? item.display_name,
    profileUrl: item.profileUrl ?? item.profile_url,
    since: typeof item.since === "string" ? dateStringToIso(item.since) : undefined,
  };
}

/** JSON genérico: resultados de FollowScope, `{followers, following}` o una lista simple. */
export function parseGenericJson(entry: TextEntry, data: unknown, platform: Platform): DetectedList[] | undefined {
  if (isPlainObject(data) && typeof data.format === "string" && data.format.startsWith("followscope.") && data.format !== FOLLOWSCOPE_RESULTS_FORMAT) {
    throw new ImportError(
      "unknown_structure",
      `«${entry.displayName}» es una exportación parcial de FollowScope (resumen, categoría o historial). Para volver a cargar un análisis, usa la exportación JSON completa («todas»).`,
    );
  }
  if (isPlainObject(data) && data.format === FOLLOWSCOPE_RESULTS_FORMAT) {
    assertPlatform(entry, typeof data.platform === "string" ? data.platform : undefined, platform);
    const categories = isPlainObject(data.categories) ? data.categories : {};
    const rows: { record: RawAccountRecord; kinds: ListKind[] | undefined }[] = [];
    for (const [category, items] of Object.entries(categories)) {
      const kinds = listsForCategory(category);
      if (!kinds || !Array.isArray(items)) continue;
      for (const item of items) rows.push({ record: recordFromJson(item), kinds });
    }
    const lists = buildLists(entry, "Resultados exportados por FollowScope (JSON)", rows);
    // Garantiza que aparezcan ambas listas aunque una esté vacía.
    for (const kind of ["followers", "following"] as const) {
      if (!lists.some((l) => l.kind === kind)) {
        lists.push({ fileName: entry.displayName, kind, format: lists[0]?.format ?? "FollowScope", records: [], fileDate: entry.fileDate, warnings: [] });
      }
    }
    return lists.filter((l) => l.kind !== "unknown");
  }
  if (isPlainObject(data) && (Array.isArray(data.followers) || Array.isArray(data.following))) {
    assertPlatform(entry, typeof data.platform === "string" ? data.platform : undefined, platform);
    const out: DetectedList[] = [];
    for (const kind of ["followers", "following"] as const) {
      const items = data[kind];
      if (Array.isArray(items)) {
        out.push({ fileName: entry.displayName, kind, format: "Listas JSON", records: items.map(recordFromJson), fileDate: entry.fileDate, warnings: [] });
      }
    }
    return out;
  }
  if (Array.isArray(data) && data.length > 0 && data.slice(0, 20).every((i) => typeof i === "string" || (isPlainObject(i) && "username" in i))) {
    return buildLists(entry, "Lista JSON", data.map((i) => ({ record: recordFromJson(i), kinds: undefined })));
  }
  return undefined;
}
