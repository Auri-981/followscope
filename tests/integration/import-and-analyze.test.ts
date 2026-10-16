import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { importFiles } from "@/importers/pipeline";
import { FileImportProvider } from "@/providers/file-import-provider";
import { officialProviders } from "@/providers/official-api-providers";
import { runAnalysis } from "@/services/analysis";
import { igFollowers, igFollowing, textFile } from "../helpers";

const samples = path.resolve(__dirname, "../../public/samples");
const sample = (rel: string) => {
  const bytes = readFileSync(path.join(samples, rel));
  return textFile(path.basename(rel), new Uint8Array(bytes));
};

describe("flujo completo: importación → proveedor → análisis", () => {
  it("analiza el ZIP de ejemplo de Instagram", async () => {
    const outcome = await importFiles({ platform: "instagram", files: [sample("instagram-export-ejemplo.zip")], isDemo: true });
    expect(outcome.canCompare).toBe(true);
    const res = await runAnalysis(new FileImportProvider(outcome, "demo_followscope"));
    if (!res.ok) throw new Error(res.message);
    const { result, snapshot, record } = res.bundle;
    expect(result.followerCount).toBe(64);
    expect(result.followingCount).toBe(62);
    expect(result.mutualCount).toBe(44);
    expect(result.notFollowingBackCount).toBe(18);
    expect(result.followsYouOnlyCount).toBe(20);
    expect(result.invariantsHold).toBe(true);
    expect(snapshot.source).toBe("demo");
    expect(record.counts.mutualCount).toBe(44);
  });

  it("analiza los JSON sueltos de Instagram y el JSON de TikTok con el mismo resultado", async () => {
    const ig = await importFiles({ platform: "instagram", files: [sample("instagram/followers_1.json"), sample("instagram/following.json")] });
    const tt = await importFiles({ platform: "tiktok", files: [sample("tiktok/user_data_tiktok.json")] });
    const a = await runAnalysis(new FileImportProvider(ig, "yo"));
    const b = await runAnalysis(new FileImportProvider(tt, "yo"));
    if (!a.ok || !b.ok) throw new Error("analysis failed");
    expect(a.bundle.snapshot.source).toBe("file_import");
    expect([b.bundle.result.mutualCount, b.bundle.result.notFollowingBackCount, b.bundle.result.followsYouOnlyCount]).toEqual([
      a.bundle.result.mutualCount,
      a.bundle.result.notFollowingBackCount,
      a.bundle.result.followsYouOnlyCount,
    ]);
    expect(b.bundle.snapshot.followers.every((e) => e.platform === "tiktok")).toBe(true);
  });

  it("pide confirmación cuando las listas tienen fechas muy distintas", async () => {
    const day = 24 * 3600 * 1000;
    const now = Date.now();
    const outcome = await importFiles({
      platform: "instagram",
      files: [textFile("followers_1.json", igFollowers(["a"]), now - 40 * day), textFile("following.json", igFollowing(["a"]), now)],
    });
    expect(Math.round(outcome.dateGapDays!)).toBe(40);
    const provider = new FileImportProvider(outcome, "yo");
    const first = await runAnalysis(provider);
    expect(first.ok).toBe(false);
    if (!first.ok) expect(first.code).toBe("date_gap_needs_confirmation");
    const confirmed = await runAnalysis(provider, { confirmDateGap: true });
    if (!confirmed.ok) throw new Error("expected ok");
    expect(confirmed.bundle.result.isComplete).toBe(false);
  });

  it("sin la lista de seguidos no hay comparación", async () => {
    const outcome = await importFiles({ platform: "instagram", files: [textFile("followers_1.json", igFollowers(["a"]))] });
    expect(outcome.canCompare).toBe(false);
    const res = await runAnalysis(new FileImportProvider(outcome, "yo"));
    expect(res.ok).toBe(false);
  });

  it("los adaptadores oficiales declaran explícitamente que no ofrecen listas", async () => {
    for (const provider of Object.values(officialProviders)) {
      expect(provider.capabilities.followersList).toBe(false);
      expect((await provider.getFollowers()).status).toBe("unsupported");
      expect((await provider.getConnectionStatus()).state).toBe("not_configured");
      const res = await runAnalysis(provider);
      expect(res.ok).toBe(false);
    }
  });

  it("la cancelación detiene la importación", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(importFiles({ platform: "instagram", files: [textFile("following.json", igFollowing(["a"]))], signal: controller.signal })).rejects.toMatchObject({ code: "cancelled" });
  });
});
