import { ImportError } from "./types";

/**
 * Calcula la profundidad máxima de anidamiento con un recorrido lineal, sin
 * recursión, para rechazar estructuras patológicas antes de `JSON.parse`.
 */
export function jsonDepth(text: string, stopAt = Infinity): number {
  let depth = 0;
  let max = 0;
  let inString = false;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (inString) {
      if (c === 92 /* \ */) i++;
      else if (c === 34 /* " */) inString = false;
      continue;
    }
    if (c === 34) inString = true;
    else if (c === 123 || c === 91 /* { [ */) {
      depth++;
      if (depth > max) {
        max = depth;
        if (max > stopAt) return max;
      }
    } else if (c === 125 || c === 93 /* } ] */) depth--;
  }
  return max;
}

export function parseJsonSafely(text: string, fileName: string, maxDepth: number): unknown {
  if (!text.trim()) throw new ImportError("file_empty", `«${fileName}» está vacío.`);
  if (jsonDepth(text, maxDepth) > maxDepth) {
    throw new ImportError("json_too_deep", `«${fileName}» tiene una estructura demasiado anidada y no se procesará por seguridad.`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new ImportError(
      "invalid_json",
      `«${fileName}» no es un JSON válido. Puede estar incompleto o dañado: vuelve a descargarlo desde la plataforma.`,
    );
  }
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
