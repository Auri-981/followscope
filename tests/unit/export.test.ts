import { describe, expect, it } from "vitest";
import { compareSnapshot } from "@/domain/compare";
import { escapeCsvCell, toCsv } from "@/export/csv";
import { exportAllCsv, exportAllJson, exportCategoryCsv, exportHistoryCsv, exportSummaryJson, type ExportContext } from "@/export/exporters";
import { parseCsv } from "@/importers/csv";
import { importFiles } from "@/importers/pipeline";
import { recordFor } from "@/services/analysis";
import { snapshotOf, textFile, usernames } from "../helpers";

const snapshot = snapshotOf(
  [{ username: "ana", displayName: '=HYPERLINK("http://x")' }, "bruno", "carlos", "diego"],
  ["bruno", "carlos", { username: "elena", displayName: 'Elena "La, de\nMadrid"' }],
);
const result = compareSnapshot(snapshot);
const ctx: ExportContext = { platform: "instagram", accountUsername: "yo", capturedAt: snapshot.capturedAt, comparedAt: result.comparedAt, isComplete: true };

describe("CSV seguro", () => {
  it("escapa comillas, separadores y saltos de línea", () => {
    expect(escapeCsvCell('a"b')).toBe('"a""b"');
    expect(escapeCsvCell("a,b")).toBe('"a,b"');
    expect(escapeCsvCell("a;b", ";")).toBe('"a;b"');
    expect(escapeCsvCell("a\nb")).toBe('"a\nb"');
    expect(escapeCsvCell(42)).toBe("42");
  });

  it("neutraliza fórmulas", () => {
    for (const v of ["=1+1", "+1", "-1", "@SUM(A1)", "\tx", "\rx"]) expect(escapeCsvCell(v).replace(/^"/, "").startsWith("'")).toBe(true);
    expect(escapeCsvCell(-5)).toBe("-5");
  });

  it("incluye BOM y CRLF", () => {
    const csv = toCsv(["a"], [["1"]]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain("\r\n");
  });

  it("el CSV exportado se vuelve a leer igual", () => {
    const file = exportCategoryCsv(ctx, "notFollowingBack", result.notFollowingBack);
    const rows = parseCsv(file.content.replace(/^﻿/, ""), file.fileName);
    expect(rows[0]).toContain("username");
    expect(rows[1]![rows[0]!.indexOf("display_name")]).toBe('Elena "La, de\nMadrid"');
  });

  it("exporta todas las categorías con columnas consistentes", () => {
    const rows = parseCsv(exportAllCsv(ctx, result).content.replace(/^﻿/, ""), "x");
    expect(rows).toHaveLength(1 + result.mutualCount + result.notFollowingBackCount + result.followsYouOnlyCount);
    expect(new Set(rows.map((r) => r.length)).size).toBe(1);
    const ana = rows.find((r) => r[3] === "ana")!;
    expect(ana[4]!.startsWith("'=")).toBe(true);
  });

  it("el separador punto y coma funciona", () => {
    const file = exportAllCsv(ctx, result, ";");
    expect(file.content.split("\r\n")[0]).toContain(";");
  });
});

describe("JSON", () => {
  it("la exportación completa se puede volver a importar y produce el mismo análisis", async () => {
    const file = exportAllJson(ctx, result);
    const outcome = await importFiles({ platform: "instagram", files: [textFile(file.fileName, file.content)] });
    expect(outcome.canCompare).toBe(true);
    expect(usernames(outcome.followers!.entries)).toEqual(["ana", "bruno", "carlos", "diego"]);
    expect(usernames(outcome.following!.entries)).toEqual(["bruno", "carlos", "elena"]);
  });

  it("la exportación completa no se acepta en otra plataforma", async () => {
    const file = exportAllJson(ctx, result);
    const outcome = await importFiles({ platform: "tiktok", files: [textFile(file.fileName, file.content)] });
    expect(outcome.errors[0]!.code).toBe("wrong_platform");
  });

  it("una exportación parcial (resumen) no se acepta como listas", async () => {
    const file = exportSummaryJson(ctx, result);
    const outcome = await importFiles({ platform: "instagram", files: [textFile(file.fileName, file.content)] });
    expect(outcome.canCompare).toBe(false);
    expect(outcome.errors[0]!.code).toBe("unknown_structure");
  });

  it("no incluye identificadores internos", () => {
    const content = exportAllJson(ctx, result).content;
    expect(content).not.toContain(snapshot.id);
    expect(content).not.toContain('"id"');
  });
});

describe("historial", () => {
  it("exporta el historial sin ids internos", () => {
    const record = recordFor(snapshot, result);
    const csv = exportHistoryCsv([record]).content;
    expect(csv).not.toContain(record.id);
    expect(csv).toContain("instagram");
  });
});
