import { Counter, Histogram, type Registry } from 'prom-client';

/** Upload screening runs on its own queue and pods; a miscalibrated threshold shows first as a hold rate. */
export interface ScreeningMetrics {
  screenSeconds: Histogram<string>;
  screeningOutcomesTotal: Counter<string>;
}

export function createScreeningMetrics(registry: Registry): ScreeningMetrics {
  const screenSeconds = new Histogram({
    name: 'screen_seconds',
    help: 'Seconds the screen stage takes for one video, by how it ended',
    labelNames: ['outcome'],
    buckets: [1, 2.5, 5, 10, 20, 30, 45, 60, 90, 120, 300, 600],
    registers: [registry],
  });

  const screeningOutcomesTotal = new Counter({
    name: 'screening_outcomes_total',
    help: 'Screened videos by outcome and the strongest reason; the hold rate is HOLD over the total',
    labelNames: ['outcome', 'reason'],
    registers: [registry],
  });

  return { screenSeconds, screeningOutcomesTotal };
}
