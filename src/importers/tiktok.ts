import type { RawAccountRecord } from "@/domain/normalize";
import { isPlainObject } from "./json";
import { baseName, dateStringToIso } from "./text";
import { ImportError, type DetectedList, type ListKind, type TextEntry } from "./types";

/**
 * Importador de la exportación de TikTok («Descargar tus datos», JSON o TXT).
 *
 * TikTok no publica un esquema oficial y ha reorganizado las secciones entre
 * versiones («Activity › Follower List › FansList», «Your Activity › Follower ›
 * FansList»…). Por eso el lector no depende de una ruta fija: recorre el JSON
 * buscando listas de objetos con un campo de nombre de usuario y clasifica cada
 * lista por los nombres de las claves que la contienen.
 *
 * Formato TXT (Follower.txt / Following.txt): bloques «Date: …» + «Username: …».
 */

const USERNAME_KEY = /^(user ?name|uniqueid|unique_id|handle)$/i;
const DATE_KEY = /^(date|time|followed ?at)$/i;
const FOLLOWERS_PATH = /fans|follower(?!ing)/i;
const FOLLOWING_PATH = /following/i;

export const TIKTOK_TXT_FILE = /(^|[\\/])[^\\/]*(follower|fans|following)[^\\/]*\.txt$/i;
export const TIKTOK_JSON_FILE = /(^|[\\/])user_data[^\\/]*\.json$/i;

export function isTikTokListPath(path: string): boolean {
  return TIKTOK_JSON_FILE.test(path) || TIKTOK_TXT_FILE.test(path);
}

function usernameKey(obj: Record<string, unknown>): string | undefined {
  return Object.keys(obj).find((k) => USERNAME_KEY.test(k));
}

function toRecord(item: unknown): RawAccountRecord {
  if (!isPlainObject(item)) return { username: undefined };
  const uKey = usernameKey(item);
  const dKey = Object.keys(item).find((k) => DATE_KEY.test(k));
  return { username: uKey ? item[uKey] : undefined, since: dKey ? dateStringToIso(item[dKey]) : undefined };
}

/** Señales de que un JSON es de TikTok (para detectar plataformas equivocadas). */
export function looksLikeTikTok(data: unknown): boolean {
  if (!isPlainObject(data)) return false;
  const keys = Object.keys(data);
  if (keys.some((k) => /^(activity|your activity|tiktok ?live|tiktok shop)$/i.test(k))) return true;
  // Segundo nivel: claves características como «Follower List» o «FansList».
  return keys.some((k) => {
    const child = data[k];
    return isPlainObject(child) && Object.keys(child).some((c) => /^(fanslist|follower list|following list)$/i.test(c));
  });
}

interface FoundList {
  kind: ListKind;
  path: string[];
  items: unknown[];
}

function classify(path: readonly string[]): ListKind | undefined {
  // Se miran las claves más cercanas a la lista: la última que encaje decide.
  for (let i = path.length - 1; i >= Math.max(0, path.length - 3); i--) {
    const key = path[i]!;
    if (FOLLOWING_PATH.test(key)) return "following";
    if (FOLLOWERS_PATH.test(key)) return "followers";
  }
  return undefined;
}

function findLists(root: unknown, maxDepth: number): FoundList[] {
  const found: FoundList[] = [];
  const stack: { value: unknown; path: string[] }[] = [{ value: root, path: [] }];
  while (stack.length) {
    const { value, path } = stack.pop()!;
    if (path.length > maxDepth) continue;
    if (Array.isArray(value)) {
      const kind = classify(path);
      const sample = value.slice(0, 20);
      const hasUsernames = sample.some((item) => isPlainObject(item) && usernameKey(item) !== undefined);
      if (kind && (hasUsernames || value.length === 0)) {
        found.push({ kind, path, items: value });
      }
      continue;
    }
    if (isPlainObject(value)) {
      for (const [key, child] of Object.entries(value)) {
        // Una lista vacía puede venir como null: se trata como lista vacía si su clave la identifica.
        if (child === null && /^(fanslist|following|followers?)$/i.test(key)) {
          const kind = classify([...path, key]);
          if (kind) found.push({ kind, path: [...path, key], items: [] });
          continue;
        }
        stack.push({ value: child, path: [...path, key] });
      }
    }
  }
  return found;
}

export function parseTikTokJson(entry: TextEntry, data: unknown, maxDepth: number): DetectedList[] {
  const lists = findLists(data, maxDepth);
  if (lists.length === 0) {
    if (looksLikeTikTok(data)) {
      throw new ImportError(
        "no_lists_in_export",
        `«${entry.displayName}» es una exportación de TikTok, pero no incluye las listas de seguidores ni de seguidos. Al solicitar tus datos, marca «Seguidores» y «Siguiendo».`,
      );
    }
    throw new ImportError("unknown_structure", `«${entry.displayName}» no tiene la estructura de una exportación de TikTok.`);
  }
  return lists.map((list) => ({
    fileName: `${entry.displayName} › ${list.path.join(" › ")}`,
    kind: list.kind,
    format: list.kind === "followers" ? "TikTok · seguidores (JSON)" : "TikTok · seguidos (JSON)",
    records: list.items.map(toRecord),
    fileDate: entry.fileDate,
    warnings: [],
  }));
}

export function looksLikeTikTokTxt(text: string): boolean {
  return /^\s*user ?name\s*:/im.test(text);
}

export function parseTikTokTxt(entry: TextEntry): DetectedList {
  const name = baseName(entry.path);
  const kind: ListKind | "unknown" = FOLLOWING_PATH.test(name) ? "following" : FOLLOWERS_PATH.test(name) ? "followers" : "unknown";
  const records: RawAccountRecord[] = [];
  let pendingDate: string | undefined;
  for (const line of entry.text.split(/\r?\n/)) {
    const match = /^\s*([A-Za-z ]+?)\s*:\s*(.*)$/.exec(line);
    if (!match) continue;
    const key = match[1]!.toLowerCase().replace(/\s+/g, "");
    const value = match[2]!.trim();
    if (key === "date") pendingDate = dateStringToIso(value);
    else if (key === "username") {
      records.push({ username: value, since: pendingDate });
      pendingDate = undefined;
    }
  }
  if (records.length === 0 && entry.text.trim()) {
    throw new ImportError("missing_username_field", `«${entry.displayName}» no contiene líneas «Username:» reconocibles.`);
  }
  return {
    fileName: entry.displayName,
    kind,
    format: kind === "following" ? "TikTok · seguidos (TXT)" : "TikTok · seguidores (TXT)",
    records,
    fileDate: entry.fileDate,
    warnings: [],
  };
}
