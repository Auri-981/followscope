import { usernameFromProfileUrl } from "@/domain/platforms";
import type { RawAccountRecord } from "@/domain/normalize";
import type { DataWarning } from "@/domain/types";
import { isPlainObject } from "./json";
import { baseName, timestampToIso } from "./text";
import { ImportError, type DetectedList, type ListKind, type TextEntry } from "./types";

/**
 * Importador de la exportación de Instagram («Descargar tu información» del
 * Centro de cuentas, formato JSON).
 *
 * Estructuras observadas (Meta no publica un esquema oficial y lo ha cambiado
 * con el tiempo, por eso el lector es tolerante):
 *
 *   followers_1.json  →  [ { "title": "", "string_list_data": [ { "href", "value", "timestamp" } ] } ]
 *                        (a veces envuelto en { "relationships_followers": [...] })
 *   following.json    →  { "relationships_following": [ { "title", "string_list_data": [...] } ] }
 *
 * En exportaciones recientes el nombre de usuario puede venir en `title` en vez
 * de en `string_list_data[0].value`, y el enlace con la forma /_u/<usuario>.
 */

export const INSTAGRAM_LIST_FILE = /(^|[\\/])(followers(?:_(\d+))?|following)\.(json|html)$/i;

export function isInstagramListPath(path: string): boolean {
  return INSTAGRAM_LIST_FILE.test(path);
}

export function instagramKindFromName(path: string): { kind?: ListKind; part?: number } {
  const match = INSTAGRAM_LIST_FILE.exec(path);
  if (!match) return {};
  const stem = match[2]!.toLowerCase();
  if (stem === "following") return { kind: "following" };
  return { kind: "followers", part: match[3] ? Number(match[3]) : 1 };
}

/** Señales de que un JSON es de Instagram (para detectar plataformas equivocadas). */
export function looksLikeInstagram(data: unknown): boolean {
  if (Array.isArray(data)) return data.slice(0, 5).some((item) => isPlainObject(item) && "string_list_data" in item);
  if (!isPlainObject(data)) return false;
  return Object.keys(data).some((k) => k.startsWith("relationships_"));
}

function recordFromItem(item: unknown): RawAccountRecord {
  if (!isPlainObject(item)) return { username: undefined };
  const list = Array.isArray(item.string_list_data) ? item.string_list_data : [];
  const first = isPlainObject(list[0]) ? list[0] : {};
  const href = typeof first.href === "string" ? first.href : undefined;
  const username =
    (typeof first.value === "string" && first.value.trim()) ||
    (typeof item.title === "string" && item.title.trim()) ||
    usernameFromProfileUrl("instagram", href);
  return { username: username || undefined, profileUrl: href, since: timestampToIso(first.timestamp) };
}

function hasUsernameData(items: readonly unknown[]): boolean {
  return items.some((item) => {
    const r = recordFromItem(item);
    return typeof r.username === "string" && r.username.length > 0;
  });
}

export function parseInstagramJson(entry: TextEntry, data: unknown): DetectedList | { ignored: string } {
  const fromName = instagramKindFromName(entry.path);
  let items: unknown[] | undefined;
  let kind: ListKind | undefined;

  if (Array.isArray(data)) {
    items = data;
    kind = "followers";
  } else if (isPlainObject(data)) {
    if (Array.isArray(data.relationships_following)) {
      items = data.relationships_following;
      kind = "following";
    } else if (Array.isArray(data.relationships_followers)) {
      items = data.relationships_followers;
      kind = "followers";
    } else {
      const other = Object.keys(data).find((k) => k.startsWith("relationships_"));
      if (other) {
        return { ignored: `Contiene «${other.replace("relationships_", "").replace(/_/g, " ")}», no seguidores ni seguidos. Se ignora.` };
      }
    }
  }

  if (!items || !kind) {
    throw new ImportError(
      "unknown_structure",
      `«${entry.displayName}» no tiene la estructura de una lista de seguidores o seguidos de Instagram.`,
    );
  }

  const warnings: DataWarning[] = [];
  if (items.length > 0 && !hasUsernameData(items)) {
    throw new ImportError(
      "missing_username_field",
      `«${entry.displayName}» no contiene nombres de usuario reconocibles. Comprueba que exportaste en formato JSON.`,
    );
  }
  if (fromName.kind && fromName.kind !== kind) {
    warnings.push({
      code: "kind_name_mismatch",
      severity: "warning",
      message: `«${baseName(entry.path)}» parece por su nombre una lista de ${fromName.kind === "followers" ? "seguidores" : "seguidos"}, pero su contenido es de ${kind === "followers" ? "seguidores" : "seguidos"}. Se usa el contenido.`,
    });
  }

  return {
    fileName: entry.displayName,
    kind,
    format: kind === "followers" ? "Instagram · seguidores (JSON)" : "Instagram · seguidos (JSON)",
    records: items.map(recordFromItem),
    fileDate: entry.fileDate,
    warnings,
    part: kind === "followers" ? fromName.part : undefined,
  };
}
