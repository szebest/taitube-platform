import { PARALLELISM, planUnitShards, TARGET_SECONDS } from '../plan-shards';

const OPTIONS = { targetSeconds: 150, parallelism: 3.2 };
const BUDGET_SECONDS = 240;

const spread = (specs: number, ms: number) =>
  Object.fromEntries(Array.from({ length: specs }, (_, index) => [`spec-${index}.test.ts`, ms]));

describe('scripts/timings: planUnitShards', () => {
  it.each([
    { name: 'no timings', timings: {}, count: 1 },
    { name: 'a trivial suite', timings: spread(10, 100), count: 1 },
    { name: 'exactly one shard of cost', timings: spread(1, 480_000), count: 1 },
    { name: 'one millisecond over a shard', timings: spread(1, 480_001), count: 2 },
    { name: 'the recorded suite', timings: spread(2584, 4_814_368 / 2584), count: 11 },
  ])('plans $count shards for $name', ({ timings, count }) => {
    const plan = planUnitShards(timings, OPTIONS);

    expect(plan.count).toBe(count);
    expect(plan.shards).toEqual(Array.from({ length: count }, (_, index) => index + 1));
  });

  it('adds shards as specs are added, and never plans fewer than one', () => {
    const counts = [0, 100, 1000, 3000, 6000, 12_000].map(
      (specs) => planUnitShards(spread(specs, 1863), OPTIONS).count
    );

    expect(counts).toEqual([...counts].sort((a, b) => a - b));
    expect(counts[0]).toBe(1);
    expect(counts.at(-1)).toBeGreaterThan(counts[0] ?? 0);
  });

  it('keeps the expected wall time of every shard of the recorded suite under the unit budget', () => {
    const totalMs = 4_814_368;
    const { count } = planUnitShards(
      { all: totalMs },
      { targetSeconds: TARGET_SECONDS, parallelism: PARALLELISM }
    );

    expect(totalMs / count / 1000 / PARALLELISM).toBeLessThanOrEqual(TARGET_SECONDS);
    expect(TARGET_SECONDS).toBeLessThan(BUDGET_SECONDS * 0.7);
  });
});
