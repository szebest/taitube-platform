function byRank([a, aScore]: [string, number], [b, bScore]: [string, number]): number {
  if (aScore !== bScore) return aScore - bScore;
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

/** Members ascending by score, then by member, as Redis ranks them. */
export function ranked(set: ReadonlyMap<string, number>): string[] {
  return [...set].sort(byRank).map(([member]) => member);
}

/** Stands in for `SEARCH_SUGGESTION_SCRIPT`: KEYS are the prefix sets, ARGV member, kept, ttl. */
export function recordSuggestion(
  sets: Map<string, Map<string, number>>,
  ttls: Map<string, number>,
  keys: string[],
  argv: string[]
): number {
  const [member, kept, ttl] = argv;
  if (member === undefined || kept === undefined || ttl === undefined) {
    throw new Error('ERR record suggestion script needs ARGV member, kept and ttl');
  }
  for (const key of keys) {
    const set = new Map(sets.get(key));
    sets.set(key, set);
    const score = set.get(member);
    if (score !== undefined) {
      set.set(member, score + 1);
    } else if (set.size < Number(kept)) {
      set.set(member, 1);
    } else {
      let inherited = 0;
      while (set.size >= Number(kept)) {
        const [lowest = ''] = ranked(set);
        inherited = set.get(lowest) ?? 0;
        set.delete(lowest);
      }
      set.set(member, inherited + 1);
    }
    ttls.set(key, Number(ttl));
  }
  return 1;
}

/** A Redis rank range: inclusive, and a negative index counts from the end. */
export function rankRange(members: string[], start: number, stop: number): string[] {
  const from = Math.max(0, start < 0 ? members.length + start : start);
  const to = stop < 0 ? members.length + stop : stop;
  return to < from ? [] : members.slice(from, to + 1);
}
