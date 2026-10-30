export const RISING = {
  windowDays: 14,
  maxSubscribers: 1000,
  minSessions: 20,
  completedPercent: 90,
  startPercent: 0,
  candidates: 200,
} as const;

export interface RisingCandidate {
  id: string;
  ownerId: string;
  createdAt: Date;
  subscriberCount: number;
  /** Viewers at the 0 percent retention step. */
  sessions: number;
  /** Viewers at the `completedPercent` step. */
  completed: number;
}

function completionRatio({
  sessions,
  completed,
}: Pick<RisingCandidate, 'sessions' | 'completed'>): number {
  return sessions > 0 ? completed / sessions : 0;
}

function isRisingEligible({
  subscriberCount,
  sessions,
}: Pick<RisingCandidate, 'subscriberCount' | 'sessions'>): boolean {
  return subscriberCount <= RISING.maxSubscribers && sessions >= RISING.minSessions;
}

function compareRising(a: RisingCandidate, b: RisingCandidate): number {
  return (
    completionRatio(b) - completionRatio(a) ||
    b.createdAt.getTime() - a.createdAt.getTime() ||
    b.id.localeCompare(a.id)
  );
}

/** Best completion first, ties by newest, one video per channel. */
export function rankRising<T extends RisingCandidate>(
  candidates: readonly T[],
  limit: number
): T[] {
  const seen = new Set<string>();
  const ranked: T[] = [];
  for (const candidate of candidates.filter(isRisingEligible).sort(compareRising)) {
    if (seen.has(candidate.ownerId)) continue;
    seen.add(candidate.ownerId);
    ranked.push(candidate);
    if (ranked.length === limit) break;
  }
  return ranked;
}
