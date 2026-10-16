import { describe, expect, it } from "vitest";
import { checkInvariants, compareSnapshot } from "@/domain/compare";
import { snapshotOf, syntheticNames, usernames } from "../helpers";

describe("motor de comparación — conjunto de referencia", () => {
  const result = compareSnapshot(snapshotOf(["@ana", "@bruno", "@carlos", "@diego"], ["@bruno", "@carlos", "@elena"]));

  it("calcula las tres categorías", () => {
    expect(usernames(result.mutualFollows)).toEqual(["bruno", "carlos"]);
    expect(usernames(result.notFollowingBack)).toEqual(["elena"]);
    expect(usernames(result.followsYouOnly)).toEqual(["ana", "diego"]);
  });

  it("produce las estadísticas esperadas", () => {
    expect(result.followerCount).toBe(4);
    expect(result.followingCount).toBe(3);
    expect(result.mutualCount).toBe(2);
    expect(result.notFollowingBackCount).toBe(1);
    expect(result.followsYouOnlyCount).toBe(2);
    expect(result.invariantsHold).toBe(true);
    expect(result.isComplete).toBe(true);
  });
});

describe("motor de comparación — casos límite", () => {
  it("ambas listas vacías", () => {
    const r = compareSnapshot(snapshotOf([], []));
    expect([r.followerCount, r.followingCount, r.mutualCount, r.notFollowingBackCount, r.followsYouOnlyCount]).toEqual([0, 0, 0, 0, 0]);
    expect(r.invariantsHold).toBe(true);
  });

  it("solo seguidores", () => {
    const r = compareSnapshot(snapshotOf(["a", "b"], []));
    expect(r.followsYouOnlyCount).toBe(2);
    expect(r.mutualCount + r.notFollowingBackCount).toBe(0);
  });

  it("solo seguidos", () => {
    const r = compareSnapshot(snapshotOf([], ["a", "b", "c"]));
    expect(r.notFollowingBackCount).toBe(3);
    expect(r.mutualCount + r.followsYouOnlyCount).toBe(0);
  });

  it("listas idénticas: todo mutuo", () => {
    const r = compareSnapshot(snapshotOf(["a", "b", "c"], ["c", "b", "a"]));
    expect(r.mutualCount).toBe(3);
    expect(r.notFollowingBackCount + r.followsYouOnlyCount).toBe(0);
  });

  it("elimina duplicados por clave estable", () => {
    const r = compareSnapshot(snapshotOf(["ana", "ana", "@ana", " ana "], ["ana", "ANA"]));
    expect(r.followerCount).toBe(1);
    expect(r.followingCount).toBe(1);
    expect(r.mutualCount).toBe(1);
    expect(r.warnings.some((w) => w.code === "duplicates_removed")).toBe(true);
  });

  it("ignora el prefijo @ y los espacios accidentales", () => {
    const r = compareSnapshot(snapshotOf(["  @bruno  ", "​carlos"], ["bruno", "@carlos "]));
    expect(r.mutualCount).toBe(2);
  });

  it("nombres visibles repetidos no fusionan cuentas distintas", () => {
    const r = compareSnapshot(
      snapshotOf(
        [
          { username: "ana1", displayName: "Ana" },
          { username: "ana2", displayName: "Ana" },
        ],
        [{ username: "ana1", displayName: "Ana" }],
      ),
    );
    expect(r.followerCount).toBe(2);
    expect(r.mutualCount).toBe(1);
    expect(usernames(r.followsYouOnly)).toEqual(["ana2"]);
  });

  it("acepta caracteres especiales válidos (puntos y guiones bajos)", () => {
    const r = compareSnapshot(snapshotOf(["a.b_c", "_x_.y"], ["a.b_c", "_x_.y"]));
    expect(r.mutualCount).toBe(2);
    expect(r.warnings.some((w) => w.code === "unusual_usernames")).toBe(false);
  });

  it("Instagram y TikTok no distinguen mayúsculas: Ana y ana son la misma cuenta", () => {
    for (const platform of ["instagram", "tiktok"] as const) {
      const r = compareSnapshot(snapshotOf(["Ana.Viaja"], ["ana.viaja"], platform));
      expect(r.mutualCount).toBe(1);
      // Se conserva el nombre original para mostrarlo.
      expect(r.mutualFollows[0]!.username).toBe("ana.viaja");
    }
  });

  it("los registros sin usuario se ignoran y se avisa", () => {
    const r = compareSnapshot(snapshotOf(["ok", "", "   ", { username: 42 }], ["ok"]));
    expect(r.followerCount).toBe(1);
    expect(r.warnings.some((w) => w.code === "invalid_records")).toBe(true);
  });

  it("descarta cuentas de otra plataforma y no da el resultado por completo", () => {
    const snap = snapshotOf(["a"], ["a"]);
    snap.followers.push({ id: "tiktok:b", platform: "tiktok", username: "b" });
    const r = compareSnapshot(snap);
    expect(r.followerCount).toBe(1);
    expect(r.isComplete).toBe(false);
  });

  it("los datos parciales nunca se marcan como completos", () => {
    const r = compareSnapshot(snapshotOf(["a"], ["a"], "instagram", { incomplete: true }));
    expect(r.isComplete).toBe(false);
  });

  it("conserva las fechas de ambas relaciones en los mutuos", () => {
    const r = compareSnapshot(
      snapshotOf([{ username: "x", since: "2025-01-01T00:00:00.000Z" }], [{ username: "x", since: "2025-02-01T00:00:00.000Z" }]),
    );
    expect(r.mutualFollows[0]).toMatchObject({ followerSince: "2025-01-01T00:00:00.000Z", followingSince: "2025-02-01T00:00:00.000Z" });
  });
});

describe("invariantes", () => {
  it("se cumplen en miles de registros aleatorios", () => {
    const followers = syntheticNames("u", 5000);
    const following = syntheticNames("u", 4000, 3000);
    const r = compareSnapshot(snapshotOf(followers, following));
    expect(r.mutualCount).toBe(2000);
    expect(r.notFollowingBackCount).toBe(2000);
    expect(r.followsYouOnlyCount).toBe(3000);
    expect(r.mutualCount + r.notFollowingBackCount).toBe(r.followingCount);
    expect(r.mutualCount + r.followsYouOnlyCount).toBe(r.followerCount);
    expect(r.invariantsHold).toBe(true);
  });

  it("detecta recuentos incoherentes", () => {
    const report = checkInvariants(
      { followerCount: 3, followingCount: 2, mutualCount: 1, notFollowingBackCount: 2, followsYouOnlyCount: 2 },
      5,
      { mutual: ["a"], notBack: ["b", "c"], youOnly: ["d", "e"] },
    );
    expect(report.holds).toBe(false);
    expect(report.failures).toContain("mutual+notFollowingBack!=following");
  });

  it("detecta categorías no disjuntas", () => {
    const report = checkInvariants(
      { followerCount: 2, followingCount: 2, mutualCount: 1, notFollowingBackCount: 1, followsYouOnlyCount: 1 },
      3,
      { mutual: ["a"], notBack: ["b"], youOnly: ["a"] },
    );
    expect(report.failures).toContain("categories_not_disjoint");
  });
});
