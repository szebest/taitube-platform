function byRank([a, aScore]: [string, number], [b, bScore]: [string, number]): number {
  if (aScore !== bScore) return aScore - bScore;
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

/** Members ascending by score, then by member, as Redis ranks them. */
export function ranked(set: ReadonlyMap<string, number>): string[] {
  return [...set].sort(byRank).map(([member]) => member);
}

/** A Redis rank range: inclusive, and a negative index counts from the end. */
export function rankRange(members: string[], start: number, stop: number): string[] {
  const from = Math.max(0, start < 0 ? members.length + start : start);
  const to = stop < 0 ? members.length + stop : stop;
  return to < from ? [] : members.slice(from, to + 1);
}
