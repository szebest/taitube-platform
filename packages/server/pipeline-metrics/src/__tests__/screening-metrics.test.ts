import { Registry } from 'prom-client';
import { createScreeningMetrics } from '../screening-metrics';

describe('createScreeningMetrics', () => {
  it('exposes the screening time by outcome and the outcomes by reason', async () => {
    const registry = new Registry();
    const metrics = createScreeningMetrics(registry);

    metrics.screenSeconds.observe({ outcome: 'HOLD' }, 12);
    metrics.screeningOutcomesTotal.inc({ outcome: 'HOLD', reason: 'DUPLICATE' });
    metrics.screeningOutcomesTotal.inc({ outcome: 'PASS', reason: 'none' });

    const scrape = await registry.metrics();
    expect(scrape).toContain('screen_seconds_count{outcome="HOLD"} 1');
    expect(scrape).toContain('screening_outcomes_total{outcome="HOLD",reason="DUPLICATE"} 1');
    expect(scrape).toContain('screening_outcomes_total{outcome="PASS",reason="none"} 1');
  });
});
