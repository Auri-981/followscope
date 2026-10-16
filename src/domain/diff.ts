import { compareSnapshot } from "./compare";
import type { AccountSnapshot, RelationEntry } from "./types";

export interface SnapshotDiff {
  fromSnapshotId: string;
  toSnapshotId: string;
  fromDate: string;
  toDate: string;
  /** Aparecen en la lista de seguidores nueva y no en la anterior. */
  newFollowers: RelationEntry[];
  /** Estaban en la lista de seguidores anterior y ya no aparecen. */
  missingFollowers: RelationEntry[];
  newFollowing: RelationEntry[];
  removedFollowing: RelationEntry[];
  newMutuals: string[];
  lostMutuals: string[];
  categoryDelta: { mutual: number; notFollowingBack: number; followsYouOnly: number; followers: number; following: number };
  /** Las dos instantáneas son completas: las diferencias son comparables. */
  reliable: boolean;
}

export type DiffRefusal = "different_platform" | "different_account";

function difference(a: readonly RelationEntry[], b: readonly RelationEntry[]): RelationEntry[] {
  const keys = new Set(b.map((e) => e.id));
  return a.filter((e) => !keys.has(e.id));
}

function setDifference(a: readonly string[], b: readonly string[]): string[] {
  const keys = new Set(b);
  return a.filter((id) => !keys.has(id));
}

/**
 * Compara dos instantáneas de la misma cuenta. Las diferencias son observadas
 * entre dos listas, no acciones confirmadas por la plataforma: no se sabe
 * cuándo ocurrió cada cambio, solo que ocurrió entre ambas fechas.
 */
export function diffSnapshots(a: AccountSnapshot, b: AccountSnapshot): SnapshotDiff | { refused: DiffRefusal } {
  if (a.platform !== b.platform) return { refused: "different_platform" };
  if (a.accountId !== b.accountId) return { refused: "different_account" };
  const [older, newer] = a.capturedAt <= b.capturedAt ? [a, b] : [b, a];

  const before = compareSnapshot(older);
  const after = compareSnapshot(newer);
  const beforeMutual = before.mutualFollows.map((m) => m.id);
  const afterMutual = after.mutualFollows.map((m) => m.id);

  return {
    fromSnapshotId: older.id,
    toSnapshotId: newer.id,
    fromDate: older.capturedAt,
    toDate: newer.capturedAt,
    newFollowers: difference(newer.followers, older.followers),
    missingFollowers: difference(older.followers, newer.followers),
    newFollowing: difference(newer.following, older.following),
    removedFollowing: difference(older.following, newer.following),
    newMutuals: setDifference(afterMutual, beforeMutual),
    lostMutuals: setDifference(beforeMutual, afterMutual),
    categoryDelta: {
      mutual: after.mutualCount - before.mutualCount,
      notFollowingBack: after.notFollowingBackCount - before.notFollowingBackCount,
      followsYouOnly: after.followsYouOnlyCount - before.followsYouOnlyCount,
      followers: after.followerCount - before.followerCount,
      following: after.followingCount - before.followingCount,
    },
    reliable: before.isComplete && after.isComplete,
  };
}
