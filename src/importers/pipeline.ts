import { defaultLimits, formatBytes, type ImportLimits } from "@/config/limits";
import { normalizeAccountList, type RawAccountRecord } from "@/domain/normalize";
import { platformLabel } from "@/domain/platforms";
import { listDateGapDays } from "@/domain/snapshot";
import type { DataWarning, Platform } from "@/domain/types";
import { parseGenericCsv, parseGenericJson, parseSimpleList, FOLLOWSCOPE_RESULTS_FORMAT } from "./generic";
import { isInstagramListPath, looksLikeInstagram, parseInstagramJson } from "./instagram";
import { isPlainObject, parseJsonSafely } from "./json";
import { decodeText, extensionOf } from "./text";
import { isTikTokListPath, looksLikeTikTok, looksLikeTikTokTxt, parseTikTokJson, parseTikTokTxt } from "./tiktok";
import {
  ImportError,
  type DetectedList,
  type FileReport,
  type ImportIssue,
  type ImportOutcome,
  type ListKind,
  type ListSummary,
  type SourceFile,
  type TextEntry,
} from "./types";
import { extractZipEntry, isZip, listZipEntries } from "./zip";

export interface ImportProgress {
  stage: "reading" | "extracting" | "parsing" | "normalizing";
  /** Ficheros procesados hasta ahora (progreso real, no estimado). */
  current: number;
  total: number;
  fileName?: string;
}

export interface ImportRequest {
  platform: Platform;
  files: SourceFile[];
  /** Tipo elegido por el usuario para listas cuyo tipo no se pudo deducir (clave: nombre mostrado). */
  kindOverrides?: Record<string, ListKind>;
  limits?: ImportLimits;
  signal?: AbortSignal;
  onProgress?: (progress: ImportProgress) => void;
  isDemo?: boolean;
}

/** Proporción de registros inválidos a partir de la cual la lista se considera incompleta. */
const INVALID_RATIO_PARTIAL = 0.1;

function checkCancelled(signal?: AbortSignal): void {
  if (signal?.aborted) throw new ImportError("cancelled", "Importación cancelada.");
}

function otherPlatform(platform: Platform): Platform {
  return platform === "instagram" ? "tiktok" : "instagram";
}

function wrongPlatform(fileName: string, detected: Platform): ImportError {
  return new ImportError(
    "wrong_platform",
    `«${fileName}» parece una exportación de ${platformLabel(detected)}. Impórtalo en la sección de ${platformLabel(detected)}.`,
  );
}

function isRelevantZipPath(platform: Platform, path: string): boolean {
  return platform === "instagram" ? isInstagramListPath(path) : isTikTokListPath(path);
}

/** Interpreta un fichero de texto y devuelve las listas que contiene. */
export function parseTextEntry(platform: Platform, entry: TextEntry, limits: ImportLimits): DetectedList[] | { ignored: string } {
  const ext = extensionOf(entry.path);
  if (!entry.text.trim()) throw new ImportError("file_empty", `«${entry.displayName}» está vacío.`);

  if (ext === "html" || ext === "htm") {
    if (isInstagramListPath(entry.path)) {
      throw new ImportError(
        "html_export",
        `«${entry.displayName}» está en formato HTML. Vuelve a solicitar la exportación de Instagram eligiendo el formato JSON.`,
      );
    }
    throw new ImportError("unsupported_format", `«${entry.displayName}»: los archivos HTML no son compatibles. Usa JSON o CSV.`);
  }

  if (ext === "json") {
    const data = parseJsonSafely(entry.text, entry.displayName, limits.maxJsonDepth);
    if (isPlainObject(data) && data.format === FOLLOWSCOPE_RESULTS_FORMAT) {
      return parseGenericJson(entry, data, platform) ?? [];
    }
    if (platform === "instagram") {
      if (looksLikeInstagram(data)) {
        const parsed = parseInstagramJson(entry, data);
        return "ignored" in parsed ? parsed : [parsed];
      }
      if (looksLikeTikTok(data)) throw wrongPlatform(entry.displayName, "tiktok");
      const generic = parseGenericJson(entry, data, platform);
      if (generic) return generic;
      throw new ImportError(
        "unknown_structure",
        `«${entry.displayName}» no es una lista de seguidores o seguidos de Instagram. Busca followers_1.json y following.json en tu exportación.`,
      );
    }
    if (looksLikeInstagram(data)) throw wrongPlatform(entry.displayName, "instagram");
    if (looksLikeTikTok(data)) return parseTikTokJson(entry, data, limits.maxJsonDepth);
    const generic = parseGenericJson(entry, data, platform);
    if (generic) return generic;
    return parseTikTokJson(entry, data, limits.maxJsonDepth);
  }

  if (ext === "csv" || ext === "tsv") return parseGenericCsv(entry, platform);

  if (ext === "txt") {
    if (looksLikeTikTokTxt(entry.text)) {
      if (platform === "instagram") throw wrongPlatform(entry.displayName, "tiktok");
      return [parseTikTokTxt(entry)];
    }
    return parseSimpleList(entry);
  }

  throw new ImportError(
    "unsupported_format",
    `«${entry.displayName}» tiene un formato no compatible${ext ? ` (.${ext})` : ""}. Usa ZIP, JSON, CSV o TXT.`,
  );
}

async function readEntries(platform: Platform, file: SourceFile, limits: ImportLimits, signal?: AbortSignal): Promise<TextEntry[]> {
  if (file.size === 0) throw new ImportError("file_empty", `«${file.name}» está vacío.`);
  const fileDate = file.lastModified ? new Date(file.lastModified).toISOString() : undefined;

  if (extensionOf(file.name) === "zip" || (await isZip(file.blob))) {
    if (file.size > limits.maxZipBytes) {
      throw new ImportError("file_too_large", `«${file.name}» supera el tamaño máximo admitido (${formatBytes(limits.maxZipBytes)}).`);
    }
    const entries = (await listZipEntries(file.blob)).filter((e) => !e.isDirectory);
    let relevant = entries.filter((e) => isRelevantZipPath(platform, e.name));
    // Si hay versión JSON de una lista de Instagram, se ignora la HTML equivalente.
    const jsonStems = new Set(relevant.filter((e) => e.name.endsWith(".json")).map((e) => e.name.replace(/\.json$/i, "")));
    relevant = relevant.filter((e) => !/\.html?$/i.test(e.name) || !jsonStems.has(e.name.replace(/\.html?$/i, "")));

    if (relevant.length === 0) {
      const other = otherPlatform(platform);
      if (entries.some((e) => isRelevantZipPath(other, e.name))) throw wrongPlatform(file.name, other);
      throw new ImportError(
        "zip_no_relevant_files",
        platform === "instagram"
          ? `«${file.name}» no contiene followers_1.json ni following.json. Al solicitar la exportación, incluye «Seguidores y seguidos» en formato JSON.`
          : `«${file.name}» no contiene las listas de TikTok (user_data.json o Follower.txt / Following.txt).`,
      );
    }
    const out: TextEntry[] = [];
    for (const entry of relevant) {
      checkCancelled(signal);
      const bytes = await extractZipEntry(file.blob, entry, limits.maxZipEntryBytes);
      out.push({ displayName: `${file.name} › ${entry.name}`, path: entry.name, text: decodeText(bytes), fileDate: entry.modifiedAt ?? fileDate });
    }
    return out;
  }

  if (file.size > limits.maxFileBytes) {
    throw new ImportError("file_too_large", `«${file.name}» supera el tamaño máximo admitido (${formatBytes(limits.maxFileBytes)}).`);
  }
  const bytes = new Uint8Array(await file.blob.arrayBuffer());
  return [{ displayName: file.name, path: file.name, text: decodeText(bytes), fileDate }];
}

function summarize(platform: Platform, kind: ListKind, lists: DetectedList[], limits: ImportLimits): { summary: ListSummary; incomplete: boolean } {
  const records: RawAccountRecord[] = [];
  const warnings: DataWarning[] = [];
  for (const list of lists) {
    for (const r of list.records) records.push(r);
    warnings.push(...list.warnings);
  }
  if (records.length > limits.maxRecords) {
    throw new ImportError(
      "too_many_records",
      `La lista de ${kind === "followers" ? "seguidores" : "seguidos"} tiene ${records.length.toLocaleString("es-ES")} registros y supera el máximo configurado (${limits.maxRecords.toLocaleString("es-ES")}).`,
    );
  }
  const normalized = normalizeAccountList(platform, records);
  let incomplete = records.length > 0 && normalized.invalidCount / records.length > INVALID_RATIO_PARTIAL;

  // Instagram divide los seguidores en followers_1.json, followers_2.json…: detecta partes ausentes.
  const parts = [...new Set(lists.map((l) => l.part).filter((p): p is number => typeof p === "number"))].sort((a, b) => a - b);
  if (parts.length > 0) {
    const missing: number[] = [];
    for (let p = 1; p <= parts[parts.length - 1]!; p++) if (!parts.includes(p)) missing.push(p);
    if (missing.length) {
      incomplete = true;
      warnings.push({
        code: "missing_parts",
        severity: "warning",
        message: `Faltan partes de la lista de seguidores: ${missing.map((p) => `followers_${p}.json`).join(", ")}. La lista está incompleta.`,
      });
    }
  }
  if (normalized.entries.length === 0) {
    warnings.push({
      code: "empty_list",
      severity: "info",
      message: `La lista de ${kind === "followers" ? "seguidores" : "seguidos"} está vacía.`,
    });
  }

  const dates = lists.map((l) => l.fileDate).filter((d): d is string => Boolean(d)).sort();
  let latest: string | undefined;
  for (const e of normalized.entries) if (e.since && (!latest || e.since > latest)) latest = e.since;
  // Si la fecha del archivo es anterior a la última relación incluida, no es fiable.
  const fileDate = dates[0] && latest && dates[0] < latest ? latest : dates[0];

  return {
    summary: {
      ...normalized,
      warnings: [...warnings, ...normalized.warnings],
      sourceFiles: lists.map((l) => l.fileName),
      fileDate,
      latestEntryAt: latest,
    },
    incomplete,
  };
}

export async function importFiles(request: ImportRequest): Promise<ImportOutcome> {
  const { platform, files, signal } = request;
  const limits = request.limits ?? defaultLimits;
  const reports: FileReport[] = [];
  const errors: ImportIssue[] = [];
  const warnings: DataWarning[] = [];
  const detected: DetectedList[] = [];
  const outcome = (extra: Partial<ImportOutcome>): ImportOutcome => ({
    platform,
    files: reports,
    warnings,
    errors,
    unresolvedFiles: [],
    incomplete: false,
    canCompare: false,
    isDemo: Boolean(request.isDemo),
    ...extra,
  });

  if (files.length === 0) {
    errors.push({ code: "no_files", message: "Selecciona al menos un archivo." });
    return outcome({});
  }
  if (files.length > limits.maxFiles) {
    errors.push({ code: "too_many_files", message: `Puedes seleccionar como máximo ${limits.maxFiles} archivos a la vez.` });
    return outcome({});
  }

  for (let i = 0; i < files.length; i++) {
    const file = files[i]!;
    checkCancelled(signal);
    request.onProgress?.({ stage: "reading", current: i, total: files.length, fileName: file.name });
    try {
      const entries = await readEntries(platform, file, limits, signal);
      for (const entry of entries) {
        checkCancelled(signal);
        request.onProgress?.({ stage: "parsing", current: i, total: files.length, fileName: entry.displayName });
        try {
          const result = parseTextEntry(platform, entry, limits);
          if ("ignored" in result) {
            reports.push({ fileName: entry.displayName, status: "ignored", message: result.ignored, fileDate: entry.fileDate });
            continue;
          }
          detected.push(...result);
        } catch (error) {
          if (error instanceof ImportError && error.code !== "cancelled") {
            reports.push({ fileName: entry.displayName, status: "error", message: error.message });
            errors.push({ code: error.code, message: error.message, fileName: entry.displayName });
          } else throw error;
        }
      }
    } catch (error) {
      if (error instanceof ImportError) {
        if (error.code === "cancelled") throw error;
        reports.push({ fileName: file.name, status: "error", message: error.message });
        errors.push({ code: error.code, message: error.message, fileName: file.name });
      } else {
        const message = `No se ha podido leer «${file.name}». Comprueba que el archivo no esté dañado.`;
        reports.push({ fileName: file.name, status: "error", message });
        errors.push({ code: "read_error", message, fileName: file.name });
      }
    }
  }

  checkCancelled(signal);
  request.onProgress?.({ stage: "normalizing", current: files.length, total: files.length });

  const unresolved: string[] = [];
  for (const list of detected) {
    if (list.kind === "unknown") {
      const override = request.kindOverrides?.[list.fileName];
      if (override) list.kind = override;
      else unresolved.push(list.fileName);
    }
    reports.push({
      fileName: list.fileName,
      status: list.kind === "unknown" ? "needs_kind" : "ok",
      format: list.format,
      kind: list.kind,
      recordCount: list.records.length,
      fileDate: list.fileDate,
      message: list.kind === "unknown" ? "Indica si este archivo contiene seguidores o seguidos." : undefined,
    });
  }

  let followers: ListSummary | undefined;
  let following: ListSummary | undefined;
  let incomplete = false;
  for (const kind of ["followers", "following"] as const) {
    const lists = detected.filter((l) => l.kind === kind);
    if (lists.length === 0) continue;
    try {
      const { summary, incomplete: partial } = summarize(platform, kind, lists, limits);
      incomplete ||= partial;
      if (kind === "followers") followers = summary;
      else following = summary;
    } catch (error) {
      if (!(error instanceof ImportError)) throw error;
      errors.push({ code: error.code, message: error.message });
    }
  }

  const pendingHint = unresolved.length ? " Si ya la has seleccionado, indica el tipo de cada archivo." : "";
  const hasFileErrors = errors.length > 0;
  if (!followers && !hasFileErrors) {
    errors.push({
      code: "missing_followers",
      message:
        (platform === "instagram"
          ? "Falta la lista de seguidores (followers_1.json)."
          : "Falta la lista de seguidores (en user_data.json o Follower.txt).") + pendingHint,
    });
  }
  if (!following && !hasFileErrors) {
    errors.push({
      code: "missing_following",
      message:
        (platform === "instagram"
          ? "Falta la lista de seguidos (following.json)."
          : "Falta la lista de seguidos (en user_data.json o Following.txt).") + pendingHint,
    });
  }

  const dateGapDays = listDateGapDays({ followers: followers?.fileDate, following: following?.fileDate });
  if (incomplete) {
    warnings.push({
      code: "incomplete_data",
      severity: "warning",
      message: "Hay indicios de que los datos están incompletos. Los resultados se marcarán como parciales.",
    });
  }

  return outcome({
    followers,
    following,
    unresolvedFiles: unresolved,
    incomplete,
    dateGapDays,
    canCompare: Boolean(followers && following) && errors.length === 0 && unresolved.length === 0,
  });
}
