const decoder = new TextDecoder("utf-8", { fatal: false });

/** Decodifica UTF-8 y elimina el BOM inicial si existe. */
export function decodeText(bytes: Uint8Array): string {
  const text = decoder.decode(bytes);
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

export function baseName(path: string): string {
  const parts = path.split(/[\/]/);
  return parts[parts.length - 1] ?? path;
}

export function extensionOf(path: string): string {
  const name = baseName(path);
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : "";
}

/** Convierte un timestamp en segundos o milisegundos a ISO, o undefined si no es plausible. */
export function timestampToIso(value: unknown): string | undefined {
  const n = typeof value === "string" ? Number(value) : value;
  if (typeof n !== "number" || !Number.isFinite(n) || n <= 0) return undefined;
  const ms = n < 1e12 ? n * 1000 : n;
  const date = new Date(ms);
  const year = date.getUTCFullYear();
  if (year < 2004 || year > 2100) return undefined;
  return date.toISOString();
}

/** Interpreta fechas tipo "2023-05-01 10:00:00" (UTC) o ISO. */
export function dateStringToIso(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const trimmed = value.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(trimmed);
  const date = match
    ? new Date(Date.UTC(+match[1]!, +match[2]! - 1, +match[3]!, +match[4]!, +match[5]!, +(match[6] ?? 0)))
    : new Date(trimmed);
  if (Number.isNaN(date.getTime())) return undefined;
  const year = date.getUTCFullYear();
  if (year < 2004 || year > 2100) return undefined;
  return date.toISOString();
}
