import { describe, expect, it } from "vitest";
import { compareSnapshot } from "@/domain/compare";
import { importFiles } from "@/importers/pipeline";
import { FileImportProvider } from "@/providers/file-import-provider";
import { runAnalysis } from "@/services/analysis";
import { igFollowers, igFollowing, snapshotOf, syntheticNames, textFile } from "../helpers";

/**
 * Pruebas de rendimiento con datos sintéticos. Imprimen tiempos y memoria
 * medidos en esta máquina; los umbrales son holgados para no fallar en CI lento.
 */
function measure<T>(fn: () => T): { value: T; ms: number } {
  const start = performance.now();
  const value = fn();
  return { value, ms: performance.now() - start };
}

describe("rendimiento", () => {
  it("compara 200.000 + 150.000 cuentas en tiempo lineal", () => {
    const followers = syntheticNames("u", 200_000);
    const following = syntheticNames("u", 150_000, 100_000);
    const snapshot = snapshotOf(followers, following);
    const heapBefore = process.memoryUsage().heapUsed;
    const { value: result, ms } = measure(() => compareSnapshot(snapshot));
    const heapMb = (process.memoryUsage().heapUsed - heapBefore) / 1024 / 1024;
    console.info(`[perf] compareSnapshot 200k/150k: ${ms.toFixed(1)} ms, Δheap ≈ ${heapMb.toFixed(1)} MB`);
    expect(result.mutualCount).toBe(100_000);
    expect(result.invariantsHold).toBe(true);
    expect(ms).toBeLessThan(5_000);

    // Comprobación de linealidad: el doble de datos no debe costar ~4 veces más.
    const small = snapshotOf(syntheticNames("u", 50_000), syntheticNames("u", 37_500, 25_000));
    const big = snapshotOf(syntheticNames("u", 100_000), syntheticNames("u", 75_000, 50_000));
    compareSnapshot(small); // calentamiento
    const tSmall = Math.min(...[0, 1, 2].map(() => measure(() => compareSnapshot(small)).ms));
    const tBig = Math.min(...[0, 1, 2].map(() => measure(() => compareSnapshot(big)).ms));
    console.info(`[perf] 87,5k registros: ${tSmall.toFixed(1)} ms · 175k registros: ${tBig.toFixed(1)} ms (ratio ${(tBig / tSmall).toFixed(2)})`);
    expect(tBig / tSmall).toBeLessThan(3.5);
  });

  it("importa y analiza 100.000 seguidores desde JSON de Instagram", async () => {
    const names = syntheticNames("cuenta.", 100_000);
    const files = [textFile("followers_1.json", igFollowers(names)), textFile("following.json", igFollowing(names.slice(50_000, 120_000)))];
    const start = performance.now();
    const outcome = await importFiles({ platform: "instagram", files });
    const tImport = performance.now() - start;
    const res = await runAnalysis(new FileImportProvider(outcome, "yo"));
    const tTotal = performance.now() - start;
    console.info(`[perf] importación 100k+50k: ${tImport.toFixed(0)} ms · total con análisis: ${tTotal.toFixed(0)} ms`);
    if (!res.ok) throw new Error(res.message);
    expect(res.bundle.result.mutualCount).toBe(50_000);
    expect(tTotal).toBeLessThan(20_000);
  });
});
