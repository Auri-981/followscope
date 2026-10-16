import { platformLabel } from "@/domain/platforms";
import type { AnalysisRecord, CategoryKey, ComparedAccount, ComparisonResult, Platform } from "@/domain/types";
import { CATEGORY_KEYS } from "@/domain/types";
import { FOLLOWSCOPE_RESULTS_FORMAT } from "@/importers/generic";
import { toCsv, type CsvSeparator } from "./csv";

/**
 * Exportadores de resultados. Solo incluyen lo necesario para el usuario:
 * nunca tokens, ids internos de almacenamiento ni datos de configuración.
 */

export const CATEGORY_LABELS: Record<CategoryKey, string> = {
  mutualFollows: "Seguimiento mutuo",
  notFollowingBack: "No te siguen de vuelta",
  followsYouOnly: "Te siguen y tú no les sigues",
};

export const CATEGORY_SLUGS: Record<CategoryKey, string> = {
  mutualFollows: "mutuos",
  notFollowingBack: "no-te-siguen",
  followsYouOnly: "te-siguen",
};

export interface ExportContext {
  platform: Platform;
  accountUsername: string;
  capturedAt: string;
  comparedAt: string;
  isComplete: boolean;
}

export interface ExportFile {
  fileName: string;
  mimeType: string;
  content: string;
}

const ACCOUNT_HEADER = ["platform", "category", "category_label", "username", "display_name", "profile_url", "follower_since", "following_since"];

function accountRow(platform: Platform, category: CategoryKey, a: ComparedAccount): unknown[] {
  return [platform, category, CATEGORY_LABELS[category], a.username, a.displayName ?? "", a.profileUrl ?? "", a.followerSince ?? "", a.followingSince ?? ""];
}

function safeSlug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "cuenta";
}

export function exportFileName(ctx: Pick<ExportContext, "platform" | "accountUsername">, suffix: string, ext: "csv" | "json"): string {
  const date = new Date().toISOString().slice(0, 10);
  return `followscope-${ctx.platform}-${safeSlug(ctx.accountUsername)}-${date}-${suffix}.${ext}`;
}

function publicAccount(a: ComparedAccount) {
  return {
    username: a.username,
    displayName: a.displayName,
    profileUrl: a.profileUrl,
    followerSince: a.followerSince,
    followingSince: a.followingSince,
  };
}

/** Una categoría (opcionalmente ya filtrada por la interfaz). */
export function exportCategoryCsv(ctx: ExportContext, category: CategoryKey, accounts: readonly ComparedAccount[], separator: CsvSeparator = ",", filtered = false): ExportFile {
  return {
    fileName: exportFileName(ctx, `${CATEGORY_SLUGS[category]}${filtered ? "-filtrado" : ""}`, "csv"),
    mimeType: "text/csv;charset=utf-8",
    content: toCsv(ACCOUNT_HEADER, accounts.map((a) => accountRow(ctx.platform, category, a)), separator),
  };
}

export function exportCategoryJson(ctx: ExportContext, category: CategoryKey, accounts: readonly ComparedAccount[], filter?: string): ExportFile {
  const payload = {
    format: "followscope.category",
    version: 1,
    exportedAt: new Date().toISOString(),
    platform: ctx.platform,
    account: ctx.accountUsername,
    capturedAt: ctx.capturedAt,
    isComplete: ctx.isComplete,
    category,
    categoryLabel: CATEGORY_LABELS[category],
    filter: filter || undefined,
    count: accounts.length,
    accounts: accounts.map(publicAccount),
  };
  return {
    fileName: exportFileName(ctx, `${CATEGORY_SLUGS[category]}${filter ? "-filtrado" : ""}`, "json"),
    mimeType: "application/json",
    content: JSON.stringify(payload, null, 2),
  };
}

/** Todas las categorías: este formato se puede volver a importar en FollowScope. */
export function exportAllCsv(ctx: ExportContext, result: ComparisonResult, separator: CsvSeparator = ","): ExportFile {
  const rows = CATEGORY_KEYS.flatMap((key) => result[key].map((a) => accountRow(ctx.platform, key, a)));
  return { fileName: exportFileName(ctx, "todas", "csv"), mimeType: "text/csv;charset=utf-8", content: toCsv(ACCOUNT_HEADER, rows, separator) };
}

export function exportAllJson(ctx: ExportContext, result: ComparisonResult): ExportFile {
  const payload = {
    format: FOLLOWSCOPE_RESULTS_FORMAT,
    version: 1,
    exportedAt: new Date().toISOString(),
    platform: ctx.platform,
    account: ctx.accountUsername,
    capturedAt: ctx.capturedAt,
    comparedAt: ctx.comparedAt,
    isComplete: ctx.isComplete,
    counts: summaryCounts(result),
    warnings: result.warnings.map((w) => w.message),
    categories: Object.fromEntries(CATEGORY_KEYS.map((key) => [key, result[key].map(publicAccount)])),
  };
  return { fileName: exportFileName(ctx, "todas", "json"), mimeType: "application/json", content: JSON.stringify(payload, null, 2) };
}

function summaryCounts(result: ComparisonResult) {
  return {
    followers: result.followerCount,
    following: result.followingCount,
    mutual: result.mutualCount,
    notFollowingBack: result.notFollowingBackCount,
    followsYouOnly: result.followsYouOnlyCount,
  };
}

export function exportSummaryCsv(ctx: ExportContext, result: ComparisonResult, separator: CsvSeparator = ","): ExportFile {
  const rows: unknown[][] = [
    ["Plataforma", platformLabel(ctx.platform)],
    ["Cuenta", ctx.accountUsername],
    ["Fecha de los datos", ctx.capturedAt],
    ["Fecha del análisis", ctx.comparedAt],
    ["Comparación completa", ctx.isComplete ? "sí" : "no"],
    ["Seguidores", result.followerCount],
    ["Seguidos", result.followingCount],
    [CATEGORY_LABELS.mutualFollows, result.mutualCount],
    [CATEGORY_LABELS.notFollowingBack, result.notFollowingBackCount],
    [CATEGORY_LABELS.followsYouOnly, result.followsYouOnlyCount],
  ];
  return { fileName: exportFileName(ctx, "resumen", "csv"), mimeType: "text/csv;charset=utf-8", content: toCsv(["metric", "value"], rows, separator) };
}

export function exportSummaryJson(ctx: ExportContext, result: ComparisonResult): ExportFile {
  const payload = {
    format: "followscope.summary",
    version: 1,
    exportedAt: new Date().toISOString(),
    platform: ctx.platform,
    account: ctx.accountUsername,
    capturedAt: ctx.capturedAt,
    comparedAt: ctx.comparedAt,
    isComplete: ctx.isComplete,
    counts: summaryCounts(result),
    warnings: result.warnings.map((w) => w.message),
  };
  return { fileName: exportFileName(ctx, "resumen", "json"), mimeType: "application/json", content: JSON.stringify(payload, null, 2) };
}

const HISTORY_HEADER = ["platform", "account", "analyzed_at", "data_date", "source", "followers", "following", "mutual", "not_following_back", "follows_you_only", "complete"];

function historyRow(r: AnalysisRecord): unknown[] {
  return [
    r.platform,
    r.accountUsername,
    r.createdAt,
    r.snapshot?.capturedAt ?? "",
    r.source,
    r.counts.followerCount,
    r.counts.followingCount,
    r.counts.mutualCount,
    r.counts.notFollowingBackCount,
    r.counts.followsYouOnlyCount,
    r.isComplete ? "yes" : "no",
  ];
}

export function exportHistoryCsv(records: readonly AnalysisRecord[], separator: CsvSeparator = ","): ExportFile {
  const date = new Date().toISOString().slice(0, 10);
  return { fileName: `followscope-historial-${date}.csv`, mimeType: "text/csv;charset=utf-8", content: toCsv(HISTORY_HEADER, records.map(historyRow), separator) };
}

export function exportHistoryJson(records: readonly AnalysisRecord[]): ExportFile {
  const date = new Date().toISOString().slice(0, 10);
  const payload = {
    format: "followscope.history",
    version: 1,
    exportedAt: new Date().toISOString(),
    analyses: records.map((r) => ({
      platform: r.platform,
      account: r.accountUsername,
      analyzedAt: r.createdAt,
      dataDate: r.snapshot?.capturedAt,
      source: r.source,
      isComplete: r.isComplete,
      counts: {
        followers: r.counts.followerCount,
        following: r.counts.followingCount,
        mutual: r.counts.mutualCount,
        notFollowingBack: r.counts.notFollowingBackCount,
        followsYouOnly: r.counts.followsYouOnlyCount,
      },
    })),
  };
  return { fileName: `followscope-historial-${date}.json`, mimeType: "application/json", content: JSON.stringify(payload, null, 2) };
}
