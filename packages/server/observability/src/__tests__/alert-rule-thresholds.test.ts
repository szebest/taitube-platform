const failureRate = (failed: number, total: number) => (total === 0 ? 0 : failed / total);

const R2_CLASS_A_THRESHOLD = 900000;
const firesR2ClassABudget = (projectedMonthlyOps: number, threshold = R2_CLASS_A_THRESHOLD) =>
  projectedMonthlyOps > threshold;

describe('alert rule thresholds (a simulation of promtool test rules)', () => {
  it.each<{ alert: string; fires: (...values: number[]) => boolean; cases: [number[], boolean][] }>(
    [
      {
        alert: 'DLQNotEmpty when dlq_entries_total increases',
        fires: (increase) => increase > 0,
        cases: [
          [[0], false],
          [[1], true],
        ],
      },
      {
        alert: 'QueueStarvation when the oldest waiting job is older than 900s',
        fires: (ageSec) => ageSec > 900,
        cases: [
          [[120], false],
          [[900], false],
          [[901], true],
          [[1200], true],
        ],
      },
      {
        alert: 'JobFailureRateHigh when the failure rate exceeds 5%',
        fires: (failed, total) => failureRate(failed, total) > 0.05,
        cases: [
          [[1, 100], false],
          [[5, 100], false],
          [[6, 100], true],
          [[20, 100], true],
        ],
      },
      {
        alert: 'SystemicFailure when the failure rate exceeds 50%',
        fires: (failed, total) => failureRate(failed, total) > 0.5,
        cases: [
          [[10, 100], false],
          [[50, 100], false],
          [[51, 100], true],
        ],
      },
      {
        alert: 'WorkerStalledJobs when more than 3 jobs stall in 30m',
        fires: (stalled) => stalled > 3,
        cases: [
          [[1], false],
          [[3], false],
          [[4], true],
        ],
      },
      {
        alert: 'WorkerStuck when any running step is stale',
        fires: (stale) => stale > 0,
        cases: [
          [[0], false],
          [[1], true],
          [[5], true],
        ],
      },
      {
        alert: 'WorkerTmpDiskHigh when worker tmp usage exceeds 80% of 8 GB',
        fires: (bytes) => bytes / 8e9 > 0.8,
        cases: [
          [[4e9], false],
          [[6.4e9], false],
          [[6.5e9], true],
          [[7.5e9], true],
        ],
      },
      {
        alert: 'APILatencyHigh when p95 exceeds 0.2s',
        fires: (p95Sec) => p95Sec > 0.2,
        cases: [
          [[0.05], false],
          [[0.19], false],
          [[0.2], false],
          [[0.25], true],
        ],
      },
      {
        alert: 'ScaleToZeroBroken when jobs wait while worker replicas are pinned at 0',
        fires: (waiting, replicas) => waiting > 0 && replicas === 0,
        cases: [
          [[0, 0], false],
          [[10, 4], false],
          [[5, 0], true],
          [[5, 1], false],
        ],
      },
    ]
  )('fires $alert', ({ fires, cases }) => {
    for (const [values, expected] of cases) {
      expect(fires(...values), `inputs ${values.join(', ')}`).toBe(expected);
    }
  });

  it('fires R2ClassABudget above the projected Class A threshold, and on normal usage once the threshold is lowered', () => {
    expect(firesR2ClassABudget(500000)).toBe(false);
    expect(firesR2ClassABudget(950000)).toBe(true);
    expect(firesR2ClassABudget(500000, 400000)).toBe(true);

    const monthlyProjected = 600 * 24 * 30;
    expect(monthlyProjected).toBe(432000);
    expect(firesR2ClassABudget(monthlyProjected)).toBe(false);
    expect(firesR2ClassABudget(monthlyProjected, 400000)).toBe(true);
  });
});
