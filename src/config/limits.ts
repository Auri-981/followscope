/**
 * Límites de importación configurables mediante variables de entorno públicas
 * (ver `.env.example`). Protegen frente a archivos enormes o maliciosos sin
 * imponer techos artificiales de unos pocos cientos de cuentas.
 */
function readNumber(raw: string | undefined, fallback: number, min: number, max: number): number {
  const value = Number(raw);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(Math.max(value, min), max);
}

const MB = 1024 * 1024;

export interface ImportLimits {
  /** Tamaño máximo de un archivo JSON/CSV/TXT suelto. */
  maxFileBytes: number;
  /** Tamaño máximo descomprimido de cada entrada extraída de un ZIP. */
  maxZipEntryBytes: number;
  /** Tamaño máximo del propio ZIP (solo se leen las entradas necesarias). */
  maxZipBytes: number;
  /** Número máximo de registros por lista. */
  maxRecords: number;
  /** Profundidad máxima de anidamiento JSON. */
  maxJsonDepth: number;
  /** Número máximo de archivos seleccionados en una importación. */
  maxFiles: number;
}

export const defaultLimits: ImportLimits = {
  maxFileBytes: readNumber(process.env.NEXT_PUBLIC_MAX_FILE_MB, 100, 1, 2048) * MB,
  maxZipEntryBytes: readNumber(process.env.NEXT_PUBLIC_MAX_ZIP_ENTRY_MB, 200, 1, 4096) * MB,
  maxZipBytes: 20 * 1024 * MB,
  maxRecords: readNumber(process.env.NEXT_PUBLIC_MAX_RECORDS, 1_000_000, 1, 10_000_000),
  maxJsonDepth: 64,
  maxFiles: 50,
};

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < MB) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * MB) return `${(bytes / MB).toFixed(1)} MB`;
  return `${(bytes / (1024 * MB)).toFixed(1)} GB`;
}
