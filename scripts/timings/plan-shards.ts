import type { Timings } from './shards';

export interface ShardPlanOptions {
  /** The wall time each shard's tests should take. */
  targetSeconds: number;
  /** How many seconds of recorded spec cost one wall-clock second runs, measured with `--maxWorkers=4`. */
  parallelism: number;
}

export interface ShardPlan {
  count: number;
  /** `1..count`, the values of the CI matrix. */
  shards: number[];
}

export const TARGET_SECONDS = 150;
export const PARALLELISM = 3.2;

/** The fewest shards that keep each one's expected wall time at or under the target. */
export function planUnitShards(
  timings: Timings,
  { targetSeconds, parallelism }: ShardPlanOptions
): ShardPlan {
  const totalMs = Object.values(timings).reduce((sum, ms) => sum + ms, 0);
  const count = Math.max(1, Math.ceil(totalMs / (targetSeconds * 1000 * parallelism)));
  return { count, shards: Array.from({ length: count }, (_, index) => index + 1) };
}
