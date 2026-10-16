import { describe, expect, it } from "vitest";
import { compareSnapshot } from "@/domain/compare";
import { diffSnapshots } from "@/domain/diff";
import { normalizeUsername, sanitizeProfileUrl, usernameFromProfileUrl } from "@/domain/platforms";
import { snapshotOf, usernames } from "../helpers";

describe("comparación de instantáneas históricas", () => {
  const older = snapshotOf(["ana", "bruno", "carlos"], ["bruno", "carlos", "elena"], "instagram", {
    listDates: { followers: "2026-01-01T00:00:00.000Z", following: "2026-01-01T00:00:00.000Z" },
    now: new Date("2026-01-02T00:00:00.000Z"),
  });
  const newer = snapshotOf(["bruno", "carlos", "diego", "elena"], ["bruno", "elena", "fran"], "instagram", {
    listDates: { followers: "2026-02-01T00:00:00.000Z", following: "2026-02-01T00:00:00.000Z" },
    now: new Date("2026-02-02T00:00:00.000Z"),
  });

  it("calcula altas, bajas y cambios de mutuos", () => {
    const diff = diffSnapshots(newer, older);
    if ("refused" in diff) throw new Error("refused");
    expect(diff.fromDate < diff.toDate).toBe(true);
    expect(usernames(diff.newFollowers)).toEqual(["diego", "elena"]);
    expect(usernames(diff.missingFollowers)).toEqual(["ana"]);
    expect(usernames(diff.newFollowing)).toEqual(["fran"]);
    expect(usernames(diff.removedFollowing)).toEqual(["carlos"]);
    expect(diff.newMutuals).toEqual(["instagram:elena"]);
    expect(diff.lostMutuals).toEqual(["instagram:carlos"]);
    const before = compareSnapshot(older);
    const after = compareSnapshot(newer);
    expect(diff.categoryDelta.mutual).toBe(after.mutualCount - before.mutualCount);
    expect(diff.reliable).toBe(true);
  });

  it("se niega a comparar cuentas o plataformas distintas", () => {
    const other = snapshotOf(["a"], ["a"], "tiktok");
    expect(diffSnapshots(older, other)).toEqual({ refused: "different_platform" });
    const otherAccount = { ...newer, accountId: "instagram:otra" };
    expect(diffSnapshots(older, otherAccount)).toEqual({ refused: "different_account" });
  });

  it("marca como no fiable una comparación con datos parciales", () => {
    const partial = snapshotOf(["a"], ["a"], "instagram", { incomplete: true });
    const diff = diffSnapshots(older, partial);
    if ("refused" in diff) throw new Error("refused");
    expect(diff.reliable).toBe(false);
  });
});

describe("instantáneas", () => {
  it("avisa cuando las listas tienen fechas muy distintas y marca parcial si el desfase es grande", () => {
    const snap = snapshotOf(["a"], ["a"], "instagram", {
      listDates: { followers: "2026-01-01T00:00:00.000Z", following: "2026-03-01T00:00:00.000Z" },
      now: new Date("2026-03-02T00:00:00.000Z"),
    });
    expect(snap.validationWarnings.some((w) => w.code === "list_date_gap")).toBe(true);
    expect(snap.completenessStatus).toBe("partial");
    expect(snap.capturedAt).toBe("2026-01-01T00:00:00.000Z");
  });

  it("avisa de exportaciones antiguas", () => {
    const snap = snapshotOf(["a"], ["a"], "instagram", {
      listDates: { followers: "2025-01-01T00:00:00.000Z", following: "2025-01-01T00:00:00.000Z" },
      now: new Date("2026-01-01T00:00:00.000Z"),
    });
    expect(snap.validationWarnings.some((w) => w.code === "old_export")).toBe(true);
  });
});

describe("reglas de plataforma", () => {
  it("normaliza nombres de usuario", () => {
    expect(normalizeUsername("instagram", "  @@Ana.Viaja ")).toMatchObject({ ok: true, display: "Ana.Viaja", key: "ana.viaja", unusual: false });
    expect(normalizeUsername("instagram", "ana viaja")).toEqual({ ok: false, reason: "invalid_characters" });
    expect(normalizeUsername("tiktok", "")).toEqual({ ok: false, reason: "empty" });
    expect(normalizeUsername("tiktok", "ñandú")).toMatchObject({ ok: true, unusual: true });
  });

  it("solo acepta enlaces https de dominios oficiales", () => {
    expect(sanitizeProfileUrl("instagram", "https://www.instagram.com/ana")).toBe("https://www.instagram.com/ana");
    expect(sanitizeProfileUrl("instagram", "javascript:alert(1)")).toBeUndefined();
    expect(sanitizeProfileUrl("instagram", "https://evil.example/ana")).toBeUndefined();
    expect(sanitizeProfileUrl("instagram", "http://www.instagram.com/ana")).toBeUndefined();
    expect(sanitizeProfileUrl("tiktok", "https://www.instagram.com/ana")).toBeUndefined();
  });

  it("extrae el usuario de enlaces de perfil", () => {
    expect(usernameFromProfileUrl("instagram", "https://www.instagram.com/_u/zoe")).toBe("zoe");
    expect(usernameFromProfileUrl("tiktok", "https://www.tiktok.com/@zoe")).toBe("zoe");
  });
});
