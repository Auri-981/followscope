import { ImportError } from "./types";

/** Detecta el separador más probable mirando la primera línea (fuera de comillas). */
export function detectDelimiter(text: string): string {
  const candidates = [",", ";", "\t"];
  const counts = new Map(candidates.map((c) => [c, 0]));
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes && (ch === "\n" || ch === "\r")) break;
    else if (!inQuotes && counts.has(ch)) counts.set(ch, counts.get(ch)! + 1);
  }
  let best = ",";
  let bestCount = 0;
  for (const [c, n] of counts) {
    if (n > bestCount) {
      best = c;
      bestCount = n;
    }
  }
  return best;
}

/**
 * Analizador CSV conforme a RFC 4180: comillas dobles, comillas escapadas ("")
 * y saltos de línea dentro de campos. Lanza un error si hay comillas sin cerrar.
 */
export function parseCsv(text: string, fileName: string, delimiter = detectDelimiter(text)): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  const n = text.length;
  while (i < n) {
    const ch = text[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }
    if (ch === '"') {
      if (field.trim() !== "") {
        throw new ImportError("malformed_csv", `«${fileName}» tiene comillas en una posición no válida (fila ${rows.length + 1}).`);
      }
      field = "";
      inQuotes = true;
      i++;
    } else if (ch === delimiter) {
      row.push(field);
      field = "";
      i++;
    } else if (ch === "\n" || ch === "\r") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i += ch === "\r" && text[i + 1] === "\n" ? 2 : 1;
    } else {
      field += ch;
      i++;
    }
  }
  if (inQuotes) {
    throw new ImportError("malformed_csv", `«${fileName}» está mal formado: hay comillas sin cerrar.`);
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}
