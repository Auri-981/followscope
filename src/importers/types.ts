import type { NormalizedList, RawAccountRecord } from "@/domain/normalize";
import type { DataWarning, Platform } from "@/domain/types";

export type ListKind = "followers" | "following";

/** Archivo de entrada. `blob` permite leer por trozos (ZIP grandes) sin cargarlo entero. */
export interface SourceFile {
  name: string;
  size: number;
  lastModified?: number;
  blob: Blob;
}

/** Fichero de texto ya extraído (de un ZIP o leído directamente). */
export interface TextEntry {
  /** Nombre para mostrar; para entradas de ZIP, "archivo.zip › ruta/interna.json". */
  displayName: string;
  /** Ruta o nombre original usado para detectar el tipo. */
  path: string;
  text: string;
  /** Fecha del fichero (entrada del ZIP o última modificación), ISO. */
  fileDate?: string;
}

/** Lista detectada en un fichero, antes de normalizar. */
export interface DetectedList {
  fileName: string;
  kind: ListKind | "unknown";
  format: string;
  records: RawAccountRecord[];
  fileDate?: string;
  warnings: DataWarning[];
  /** Para Instagram: número de parte (followers_2.json → 2). */
  part?: number;
}

export type FileStatus = "ok" | "error" | "ignored" | "needs_kind";

export interface FileReport {
  fileName: string;
  status: FileStatus;
  format?: string;
  kind?: ListKind | "unknown";
  recordCount?: number;
  fileDate?: string;
  message?: string;
}

export interface ImportIssue {
  code: ImportErrorCode;
  message: string;
  fileName?: string;
}

export interface ListSummary extends NormalizedList {
  sourceFiles: string[];
  /** Fecha más antigua de los ficheros que componen la lista. */
  fileDate?: string;
  /** Fecha de la relación más reciente incluida en la lista. */
  latestEntryAt?: string;
}

export interface ImportOutcome {
  platform: Platform;
  files: FileReport[];
  followers?: ListSummary;
  following?: ListSummary;
  warnings: DataWarning[];
  errors: ImportIssue[];
  /** Ficheros válidos cuyo tipo (seguidores/seguidos) debe indicar el usuario. */
  unresolvedFiles: string[];
  /** Hay indicios de que alguna lista está incompleta. */
  incomplete: boolean;
  dateGapDays?: number;
  /** Ambas listas presentes, sin errores bloqueantes. */
  canCompare: boolean;
  /** Los datos proceden de los ejemplos incluidos en la aplicación. */
  isDemo: boolean;
}

export type ImportErrorCode =
  | "no_files"
  | "too_many_files"
  | "file_empty"
  | "file_too_large"
  | "read_error"
  | "invalid_json"
  | "json_too_deep"
  | "malformed_csv"
  | "missing_username_field"
  | "wrong_platform"
  | "unsupported_format"
  | "unknown_structure"
  | "html_export"
  | "too_many_records"
  | "zip_invalid"
  | "zip_encrypted"
  | "zip_unsupported_compression"
  | "zip_entry_too_large"
  | "zip_corrupt_entry"
  | "zip_no_relevant_files"
  | "no_lists_in_export"
  | "missing_followers"
  | "missing_following"
  | "cancelled";

export class ImportError extends Error {
  constructor(
    public readonly code: ImportErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ImportError";
  }
}
