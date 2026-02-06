/**
 * Matching Engine — ported from gas/MatchingEngine.gs
 *
 * Logic flow:
 * 1. Group participants by session type
 * 2. Sort by streak (descending) within each session
 * 3. Form 2-3 person groups (4 → 2+2 rule)
 * 4. Single leftover → Universal Pool
 * 5. Universal Pool re-matching
 * 6. Final single leftover → Lobby
 */

export interface Participant {
  userId: string;
  instagram: string;
  streak: number;
  sessionType: string;
}

export interface Group {
  members: Participant[];
  type: "matched" | "universal" | "lobby";
  sessionType: string;
  avgStreak: number;
}

export interface MatchResult {
  groups: Group[];
  lobbyUsers: Participant[];
}

/**
 * Run the matching engine on a list of participants.
 */
export function runMatching(participants: Participant[]): MatchResult {
  // 1. Group by session type
  const sessionGroups = groupBySession(participants);

  // 2. Process each session (sort + group)
  const allGroups: Group[] = [];
  const universalPool: Participant[] = [];

  for (const [sessionType, users] of sessionGroups) {
    // Sort by streak descending
    users.sort((a, b) => b.streak - a.streak);

    // Distribute into 2-3 person groups
    const result = distributeToGroups(users, sessionType, "matched");

    allGroups.push(...result.groups);

    if (result.leftover) {
      universalPool.push(result.leftover);
    }
  }

  // 3. Process Universal Pool
  const lobbyUsers: Participant[] = [];

  if (universalPool.length > 0) {
    universalPool.sort((a, b) => b.streak - a.streak);

    const poolResult = distributeToGroups(
      universalPool,
      "Universal Pool",
      "universal"
    );

    allGroups.push(...poolResult.groups);

    if (poolResult.leftover) {
      lobbyUsers.push(poolResult.leftover);
    }
  }

  return { groups: allGroups, lobbyUsers };
}

/**
 * Group participants by session type.
 */
export function groupBySession(
  participants: Participant[]
): Map<string, Participant[]> {
  const groups = new Map<string, Participant[]>();

  for (const user of participants) {
    const existing = groups.get(user.sessionType);
    if (existing) {
      existing.push(user);
    } else {
      groups.set(user.sessionType, [user]);
    }
  }

  return groups;
}

/**
 * Distribute sorted users into 2-3 person groups.
 *
 * Rules:
 * - Min 2, max 3 per group
 * - 4 people → 2+2 (never 3+1)
 * - 5+ → take 3 at a time
 * - 1 leftover → returned separately
 */
export function distributeToGroups(
  sortedUsers: Participant[],
  sessionType: string,
  groupType: "matched" | "universal"
): { groups: Group[]; leftover: Participant | null } {
  const groups: Group[] = [];
  let remaining = [...sortedUsers];

  while (remaining.length > 0) {
    const n = remaining.length;

    if (n === 1) {
      return { groups, leftover: remaining[0] };
    }

    let size: number;
    if (n === 2) {
      size = 2;
    } else if (n === 3) {
      size = 3;
    } else if (n === 4) {
      size = 2; // 4 → 2+2 rule
    } else {
      size = 3; // 5+ → take 3
    }

    const members = remaining.slice(0, size);
    remaining = remaining.slice(size);

    groups.push({
      members,
      type: groupType,
      sessionType,
      avgStreak: calculateAvgStreak(members),
    });
  }

  return { groups, leftover: null };
}

/**
 * Calculate average streak for a group.
 */
export function calculateAvgStreak(members: Participant[]): number {
  if (members.length === 0) return 0;
  const total = members.reduce((sum, m) => sum + m.streak, 0);
  return Math.round(total / members.length);
}

/**
 * Calculate optimal group sizes for N people.
 */
export function calculateGroupSizes(n: number): number[] {
  if (n < 2) return [];
  if (n === 2) return [2];
  if (n === 3) return [3];
  if (n === 4) return [2, 2];

  const sizes: number[] = [];
  let remaining = n;

  while (remaining > 0) {
    if (remaining === 2) {
      sizes.push(2);
      remaining = 0;
    } else if (remaining === 4) {
      sizes.push(2, 2);
      remaining = 0;
    } else {
      sizes.push(3);
      remaining -= 3;
    }
  }

  return sizes;
}
