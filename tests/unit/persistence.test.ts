import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { describe, expect, it } from "vitest";
import { compareSnapshot } from "@/domain/compare";
import { IndexedDbAnalysisRepository } from "@/persistence/indexeddb";
import { MemoryAnalysisRepository, type AnalysisRepository } from "@/persistence/repository";
import { recordFor, summaryOnly } from "@/services/analysis";
import { snapshotOf } from "../helpers";

function makeRecord(space: string, platform: "instagram" | "tiktok" = "instagram") {
  const snapshot = snapshotOf(["a", "b"], ["b"], platform);
  return recordFor(snapshot, compareSnapshot(snapshot), space);
}

const implementations: [string, () => AnalysisRepository][] = [
  ["memoria", () => new MemoryAnalysisRepository()],
  ["IndexedDB", () => new IndexedDbAnalysisRepository(new IDBFactory())],
];

describe.each(implementations)("repositorio en %s", (_name, make) => {
  it("guarda, lista, abre y borra", async () => {
    const repo = make();
    const r1 = makeRecord("local");
    const r2 = makeRecord("local", "tiktok");
    await repo.save("local", r1);
    await repo.save("local", r2);
    expect((await repo.list("local")).map((r) => r.id).sort()).toEqual([r1.id, r2.id].sort());
    expect(await repo.list("local", { platform: "tiktok" })).toHaveLength(1);
    expect((await repo.get("local", r1.id))?.snapshot?.followers).toHaveLength(2);
    expect(await repo.delete("local", r1.id)).toBe(true);
    expect(await repo.get("local", r1.id)).toBeUndefined();
    expect(await repo.clear("local")).toBe(1);
  });

  it("guarda solo el resumen si se pide", async () => {
    const repo = make();
    const r = summaryOnly(makeRecord("local"));
    await repo.save("local", r);
    const loaded = await repo.get("local", r.id);
    expect(loaded?.snapshot).toBeUndefined();
    expect(loaded?.counts.followerCount).toBe(2);
  });

  it("separa los datos entre espacios: un id ajeno no da acceso", async () => {
    const repo = make();
    const mine = makeRecord("usuario-a");
    const theirs = makeRecord("usuario-b");
    await repo.save("usuario-a", mine);
    await repo.save("usuario-b", theirs);
    expect(await repo.get("usuario-a", theirs.id)).toBeUndefined();
    expect(await repo.delete("usuario-a", theirs.id)).toBe(false);
    expect(await repo.list("usuario-a")).toHaveLength(1);
    await expect(repo.save("usuario-a", theirs)).rejects.toThrow("space_mismatch");
    expect(await repo.clear("usuario-a")).toBe(1);
    expect(await repo.get("usuario-b", theirs.id)).toBeDefined();
  });
});
