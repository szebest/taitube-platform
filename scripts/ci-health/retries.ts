import { table } from './markdown';
import type { Run } from './model';

export interface RetriedRow {
  test: string;
  runs: number;
}

/** Every test that passed only on its retry, with how many runs it happened in, most first. */
export function retries(runs: readonly Run[]): RetriedRow[] {
  const counts = new Map<string, number>();
  for (const run of runs) {
    for (const test of new Set(run.retried.map((retried) => retried.test))) {
      counts.set(test, (counts.get(test) ?? 0) + 1);
    }
  }
  return [...counts]
    .map(([test, count]) => ({ test, runs: count }))
    .sort((a, b) => b.runs - a.runs || (a.test < b.test ? -1 : 1));
}

export function renderRetries(rows: readonly RetriedRow[]): string {
  if (rows.length === 0) return 'No test passed only on its retry.';
  return table(
    ['Spec > test', 'Runs'],
    rows.map((row) => [row.test.replace(/\|/g, '\\|'), row.runs])
  );
}
