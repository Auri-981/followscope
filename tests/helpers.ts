import { normalizeAccountList, type RawAccountRecord } from "@/domain/normalize";
import { buildSnapshot } from "@/domain/snapshot";
import type { AccountSnapshot, Platform } from "@/domain/types";
import type { SourceFile } from "@/importers/types";

export function snapshotOf(
  followers: (string | RawAccountRecord)[],
  following: (string | RawAccountRecord)[],
  platform: Platform = "instagram",
  extra: Partial<Parameters<typeof buildSnapshot>[0]> = {},
): AccountSnapshot {
  const toRecords = (list: (string | RawAccountRecord)[]) => list.map((x) => (typeof x === "string" ? { username: x } : x));
  const f = normalizeAccountList(platform, toRecords(followers));
  const g = normalizeAccountList(platform, toRecords(following));
  return buildSnapshot({
    platform,
    ownerUsername: "yo",
    source: "file_import",
    followers: f.entries,
    following: g.entries,
    listDates: {},
    warnings: [...f.warnings, ...g.warnings],
    ...extra,
  });
}

export function usernames(list: { username: string }[]): string[] {
  return list.map((a) => a.username).sort();
}

export function textFile(name: string, content: string | Uint8Array, lastModified?: number): SourceFile {
  const blob = new Blob([content as BlobPart]);
  return { name, size: blob.size, lastModified, blob };
}

export function igFollowers(names: string[]): string {
  return JSON.stringify(
    names.map((u, i) => ({ title: "", media_list_data: [], string_list_data: [{ href: `https://www.instagram.com/${u}`, value: u, timestamp: 1_700_000_000 + i }] })),
  );
}

export function igFollowing(names: string[], style: "value" | "title" = "title"): string {
  return JSON.stringify({
    relationships_following: names.map((u, i) =>
      style === "title"
        ? { title: u, string_list_data: [{ href: `https://www.instagram.com/_u/${u}`, timestamp: 1_700_000_000 + i }] }
        : { title: "", string_list_data: [{ href: `https://www.instagram.com/${u}`, value: u, timestamp: 1_700_000_000 + i }] },
    ),
  });
}

export function tiktokUserData(followers: string[], following: string[], layout: "classic" | "recent" = "classic"): string {
  const fans = followers.map((u) => ({ Date: "2026-01-02 10:00:00", UserName: u }));
  const fol = following.map((u) => ({ Date: "2026-01-03 10:00:00", UserName: u }));
  return JSON.stringify(
    layout === "classic"
      ? { Activity: { "Follower List": { FansList: fans }, "Following List": { Following: fol } } }
      : { "Your Activity": { Follower: { FansList: fans }, Following: { Following: fol } } },
  );
}

export function syntheticNames(prefix: string, count: number, offset = 0): string[] {
  return Array.from({ length: count }, (_, i) => `${prefix}${i + offset}`);
}
