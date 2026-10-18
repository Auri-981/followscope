import { describe, expect, it } from "vitest";
import { normalizeAccountList } from "@/domain/normalize";
import { compareSnapshot } from "@/domain/compare";
import { importFiles } from "@/importers/pipeline";
import { detectLimitedPeriod } from "@/importers/period";
import { FileImportProvider } from "@/providers/file-import-provider";
import { runAnalysis } from "@/services/analysis";
import { textFile } from "../helpers";

const ts = (iso: string) => Math.floor(new Date(iso).getTime() / 1000);

/** Reproduce el caso real: seguidores solo desde una fecha, seguidos desde mucho antes. */
function limitedExport() {
  const followers = Array.from({ length: 40 }, (_, i) => ({ u: `nuevo${i}`, t: ts("2025-10-29") + i * 86_400 }));
  const following = [
    ...Array.from({ length: 12 }, (_, i) => ({ u: `antiguo${i}`, t: ts("2024-09-13") + i * 86_400 })),
    ...Array.from({ length: 10 }, (_, i) => ({ u: `nuevo${i}`, t: ts("2026-01-01") + i * 86_400 })),
  ];
  return {
    followersJson: JSON.stringify(
      followers.map((f) => ({ title: "", media_list_data: [], string_list_data: [{ href: `https://www.instagram.com/${f.u}`, value: f.u, timestamp: f.t }] })),
    ),
    followingJson: JSON.stringify({
      relationships_following: following.map((f) => ({ title: f.u, string_list_data: [{ href: `https://www.instagram.com/_u/${f.u}`, timestamp: f.t }] })),
    }),
  };
}

const entries = (rows: { u: string; since?: string }[]) => normalizeAccountList("instagram", rows.map((r) => ({ username: r.u, since: r.since }))).entries;

describe("exportaciones con periodo limitado", () => {
  it("detecta seguidores recortados por fecha y marca el análisis como parcial", async () => {
    const { followersJson, followingJson } = limitedExport();
    const outcome = await importFiles({ platform: "instagram", files: [textFile("followers_1.json", followersJson), textFile("following.json", followingJson)] });
    const warning = outcome.warnings.find((w) => w.code === "limited_period_export");
    expect(warning).toBeDefined();
    expect(warning!.message).toContain("29 de octubre de 2025");
    expect(warning!.message).toContain("12 cuentas");
    expect(outcome.incomplete).toBe(true);
    // Se puede comparar, pero el resultado no se presenta como completo.
    expect(outcome.canCompare).toBe(true);
    const res = await runAnalysis(new FileImportProvider(outcome, "yo"));
    if (!res.ok) throw new Error(res.message);
    expect(res.bundle.result.isComplete).toBe(false);
    expect(res.bundle.result.warnings.some((w) => w.code === "limited_period_export")).toBe(true);
  });

  it("no avisa en una exportación completa con seguidores antiguos", () => {
    const followers = entries([
      { u: "a", since: "2023-01-10T00:00:00.000Z" },
      { u: "b", since: "2024-05-01T00:00:00.000Z" },
    ]);
    const following = entries(Array.from({ length: 20 }, (_, i) => ({ u: `x${i}`, since: "2023-03-01T00:00:00.000Z" })));
    expect(detectLimitedPeriod(followers, following)).toBeUndefined();
  });

  it("no avisa si solo unas pocas cuentas seguidas son anteriores", () => {
    const followers = entries([{ u: "a", since: "2025-10-29T00:00:00.000Z" }]);
    const following = entries(Array.from({ length: 4 }, (_, i) => ({ u: `x${i}`, since: "2024-01-01T00:00:00.000Z" })));
    expect(detectLimitedPeriod(followers, following)).toBeUndefined();
  });

  it("no avisa si la diferencia de fechas es pequeña", () => {
    const followers = entries([{ u: "a", since: "2025-10-29T00:00:00.000Z" }]);
    const following = entries(Array.from({ length: 10 }, (_, i) => ({ u: `x${i}`, since: "2025-09-15T00:00:00.000Z" })));
    expect(detectLimitedPeriod(followers, following)).toBeUndefined();
  });

  it("no aplica la comprobación si las listas no tienen fechas", () => {
    const followers = entries([{ u: "a" }]);
    const following = entries(Array.from({ length: 10 }, (_, i) => ({ u: `x${i}` })));
    expect(detectLimitedPeriod(followers, following)).toBeUndefined();
  });

  it("los datos de demostración no disparan el aviso", async () => {
    const { readFileSync } = await import("node:fs");
    const path = await import("node:path");
    const zip = readFileSync(path.resolve(__dirname, "../../public/samples/instagram-export-ejemplo.zip"));
    const outcome = await importFiles({ platform: "instagram", files: [textFile("demo.zip", new Uint8Array(zip))] });
    expect(outcome.warnings.some((w) => w.code === "limited_period_export")).toBe(false);
    void compareSnapshot;
  });
});
