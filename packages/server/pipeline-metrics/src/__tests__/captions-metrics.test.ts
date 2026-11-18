import { Registry } from 'prom-client';
import { createCaptionsMetrics } from '../captions-metrics';

describe('createCaptionsMetrics', () => {
  it('exposes the real-time factor by model, the time to ready and the runs by outcome', async () => {
    const registry = new Registry();
    const metrics = createCaptionsMetrics(registry);

    metrics.captionsRealtimeFactor.observe({ model: 'small-q5_1' }, 1.4);
    metrics.captionsTimeToReady.observe(240);
    metrics.captionsJobsTotal.inc({ outcome: 'ready' });

    const scrape = await registry.metrics();
    expect(scrape).toContain('captions_realtime_factor_count{model="small-q5_1"} 1');
    expect(scrape).toContain('captions_time_to_ready_seconds_count 1');
    expect(scrape).toContain('captions_jobs_total{outcome="ready"} 1');
  });
});
