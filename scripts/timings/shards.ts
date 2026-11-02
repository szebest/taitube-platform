import { percentile } from '../ci-timings';

/** Milliseconds per spec file, by its path from the repository root. */
export type Timings = Readonly<Record<string, number>>;

export interface Costed {
  key: string;
  cost: number;
}

/**
 * The recorded cost of each path. A path run by two projects (a universal package's jsdom pass)
 * was recorded once per project and summed, so each run takes its share; an unknown path the median.
 */
export function costs(paths: readonly string[], timings: Timings): number[] {
  const fallback = percentile(Object.values(timings), 0.5);
  const runs = new Map<string, number>();
  for (const path of paths) runs.set(path, (runs.get(path) ?? 0) + 1);
  return paths.map((path) => {
    const recorded = timings[path];
    return recorded === undefined ? fallback : recorded / (runs.get(path) ?? 1);
  });
}

const byCostThenKey = (a: Costed, b: Costed): number =>
  b.cost - a.cost || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0);

/** Longest first, each file to the shard with the least cost so far; the order makes it deterministic. */
export function assignShards<T extends Costed>(files: readonly T[], count: number): T[][] {
  const shards = Array.from({ length: count }, () => ({ total: 0, files: [] as T[] }));
  for (const file of [...files].sort(byCostThenKey)) {
    const lightest = shards.reduce((min, shard) => (shard.total < min.total ? shard : min));
    lightest.files.push(file);
    lightest.total += file.cost;
  }
  return shards.map((shard) => shard.files);
}
