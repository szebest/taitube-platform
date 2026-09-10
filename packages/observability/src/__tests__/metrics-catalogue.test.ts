import { describe, expect, it } from 'vitest';
import { createMetricsRegistry, getMetrics } from '../metrics.js';

describe('Metrics Catalogue Conformance (SDD §13.1)', () => {
  const EXPECTED_METRICS = [
    { name: 'http_request_duration_seconds', type: 'histogram', labels: ['method', 'route', 'status'] },
    { name: 'http_requests_in_flight', type: 'gauge', labels: [] },
    { name: 'sse_connections', type: 'gauge', labels: ['channel_type'] },
    { name: 'sse_events_published_total', type: 'counter', labels: ['event'] },
    { name: 'bullmq_queue_jobs', type: 'gauge', labels: ['queue', 'state'] },
    { name: 'bullmq_queue_oldest_waiting_age_seconds', type: 'gauge', labels: ['queue'] },
    { name: 'jobs_processed_total', type: 'counter', labels: ['queue', 'result'] },
    { name: 'job_duration_seconds', type: 'histogram', labels: ['queue'] },
    { name: 'job_wait_seconds', type: 'histogram', labels: ['queue'] },
    { name: 'transcode_realtime_factor', type: 'histogram', labels: ['rendition', 'preset'] },
    { name: 'transcode_output_bytes_total', type: 'counter', labels: ['rendition'] },
    { name: 'ffmpeg_exit_total', type: 'counter', labels: ['stage', 'code'] },
    { name: 'storage_ops_total', type: 'counter', labels: ['op', 'bucket', 'result'] },
    { name: 'storage_op_duration_seconds', type: 'histogram', labels: ['op', 'bucket', 'result'] },
    { name: 'worker_tmp_bytes', type: 'gauge', labels: ['stage'] },
    { name: 'dlq_entries_total', type: 'counter', labels: ['queue', 'error_code'] },
    { name: 'videos_by_status', type: 'gauge', labels: ['status'] },
    { name: 'time_to_ready_seconds', type: 'histogram', labels: ['bucket'] },
  ];

  it('registers all 18 metrics in the registry', async () => {
    const metrics = createMetricsRegistry();
    const registeredMetrics = await metrics.registry.getMetricsAsJSON();
    expect(registeredMetrics.length).toBeGreaterThanOrEqual(18);
  });

  it.each(EXPECTED_METRICS)(
    'metric "$name" has correct type ($type) and labels ($labels)',
    async ({ name, type, labels }) => {
      const metrics = createMetricsRegistry();
      const registeredMetrics = await metrics.registry.getMetricsAsJSON();
      const found = registeredMetrics.find((m) => m.name === name);

      expect(found, `Metric "${name}" must be registered`).toBeDefined();
      expect(String(found?.type).toLowerCase(), `Metric "${name}" type mismatch`).toBe(type);

      const metricInstance = metrics.registry.getSingleMetric(name) as unknown as { labelNames?: string[] };
      const labelNames = metricInstance?.labelNames ?? [];
      for (const lbl of labels) {
        expect(labelNames, `Metric "${name}" should include label "${lbl}"`).toContain(lbl);
      }
    },
  );

  it('provides singleton getMetrics() returning initialized registry', () => {
    const m1 = getMetrics();
    const m2 = getMetrics();
    expect(m1).toBe(m2);
    expect(m1.bullmqQueueJobs).toBeDefined();
  });
});
