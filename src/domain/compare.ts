import type {
  AccountSnapshot,
  ComparedAccount,
  ComparisonCounts,
  ComparisonResult,
  DataWarning,
  RelationEntry,
} from "./types";

export interface InvariantReport {
  holds: boolean;
  failures: string[];
}

/**
 * Comprueba las invariantes obligatorias de una comparación:
 *  - M, N y S son disjuntos.
 *  - |M| + |N| + |S| = |F ∪ G|
 *  - |M| + |N| = |G|
 *  - |M| + |S| = |F|
 */
export function checkInvariants(
  counts: ComparisonCounts,
  unionSize: number,
  sets: { mutual: readonly string[]; notBack: readonly string[]; youOnly: readonly string[] },
): InvariantReport {
  const failures: string[] = [];
  const { mutualCount: m, notFollowingBackCount: n, followsYouOnlyCount: s, followerCount: f, followingCount: g } = counts;
  if (m + n !== g) failures.push("mutual+notFollowingBack!=following");
  if (m + s !== f) failures.push("mutual+followsYouOnly!=followers");
  if (m + n + s !== unionSize) failures.push("sum!=union");
  const seen = new Set<string>();
  for (const list of [sets.mutual, sets.notBack, sets.youOnly]) {
    for (const id of list) {
      if (seen.has(id)) {
        failures.push("categories_not_disjoint");
        return { holds: false, failures };
      }
      seen.add(id);
    }
  }
  return { holds: failures.length === 0, failures };
}

function indexById(platform: string, list: readonly RelationEntry[], warnings: DataWarning[]): Map<string, RelationEntry> {
  const map = new Map<string, RelationEntry>();
  let foreign = 0;
  for (const entry of list) {
    if (entry.platform !== platform) {
      foreign++;
      continue;
    }
    if (!map.has(entry.id)) map.set(entry.id, entry);
  }
  if (foreign > 0) {
    warnings.push({
      code: "foreign_platform_entries",
      severity: "blocking",
      message: `Se han descartado ${foreign} cuenta(s) de otra plataforma. Las cuentas de Instagram y TikTok nunca se mezclan.`,
    });
  }
  return map;
}

function strip(entry: RelationEntry): ComparedAccount {
  const { since: _since, ...account } = entry;
  void _since;
  return account;
}

/**
 * Motor de comparación. Con F = seguidores y G = seguidos calcula:
 *   M = F ∩ G (mutuos), N = G − F (no te siguen de vuelta), S = F − G (te siguen y no les sigues).
 * Usa mapas hash: coste esperado O(n + m). No depende de React ni del navegador.
 */
export function compareSnapshot(snapshot: AccountSnapshot, now: Date = new Date()): ComparisonResult {
  const warnings: DataWarning[] = [...snapshot.validationWarnings];
  const followers = indexById(snapshot.platform, snapshot.followers, warnings);
  const following = indexById(snapshot.platform, snapshot.following, warnings);

  const mutualFollows: ComparedAccount[] = [];
  const notFollowingBack: ComparedAccount[] = [];
  const followsYouOnly: ComparedAccount[] = [];

  for (const [id, followed] of following) {
    const follower = followers.get(id);
    if (follower) {
      mutualFollows.push({
        ...strip(followed),
        displayName: followed.displayName ?? follower.displayName,
        profileUrl: followed.profileUrl ?? follower.profileUrl,
        followerSince: follower.since,
        followingSince: followed.since,
      });
    } else {
      notFollowingBack.push({ ...strip(followed), followingSince: followed.since });
    }
  }
  for (const [id, follower] of followers) {
    if (!following.has(id)) followsYouOnly.push({ ...strip(follower), followerSince: follower.since });
  }

  const counts: ComparisonCounts = {
    followerCount: followers.size,
    followingCount: following.size,
    mutualCount: mutualFollows.length,
    notFollowingBackCount: notFollowingBack.length,
    followsYouOnlyCount: followsYouOnly.length,
  };
  // |F ∪ G| = |F| + |G| − |F ∩ G|, calculado de forma independiente a las categorías.
  let intersection = 0;
  for (const id of followers.keys()) if (following.has(id)) intersection++;
  const unionSize = followers.size + following.size - intersection;

  const invariants = checkInvariants(counts, unionSize, {
    mutual: mutualFollows.map((a) => a.id),
    notBack: notFollowingBack.map((a) => a.id),
    youOnly: followsYouOnly.map((a) => a.id),
  });

  if (!invariants.holds) {
    // Registro técnico sin datos personales: solo recuentos y nombres de invariantes.
    console.error("[FollowScope] Invariante de comparación incumplida", { failures: invariants.failures, ...counts, unionSize });
    warnings.push({
      code: "invariant_failed",
      severity: "blocking",
      message: "Los resultados no superaron la verificación interna y no deben considerarse válidos.",
    });
  }

  const hasBlocking = warnings.some((w) => w.severity === "blocking");
  return {
    snapshotId: snapshot.id,
    comparedAt: now.toISOString(),
    mutualFollows,
    notFollowingBack,
    followsYouOnly,
    ...counts,
    invariantsHold: invariants.holds,
    isComplete: invariants.holds && !hasBlocking && snapshot.completenessStatus === "complete",
    warnings: dedupeWarnings(warnings),
  };
}

export function dedupeWarnings(warnings: readonly DataWarning[]): DataWarning[] {
  const seen = new Set<string>();
  return warnings.filter((w) => {
    const key = `${w.code}|${w.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function countsOf(result: ComparisonResult): ComparisonCounts {
  return {
    followerCount: result.followerCount,
    followingCount: result.followingCount,
    mutualCount: result.mutualCount,
    notFollowingBackCount: result.notFollowingBackCount,
    followsYouOnlyCount: result.followsYouOnlyCount,
  };
}
