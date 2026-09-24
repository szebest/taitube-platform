import * as fs from 'node:fs';
import * as path from 'node:path';
import { createMetricsRegistry } from '../metrics';
import { MetricsServer } from '../server';

/**
 * Extracts metric names from the markdown table in docs/SDD.md §13.1.
 */
function parseSddMetricNames(): string[] {
  // Locate SDD.md relative to monorepo root: packages/observability/src/__tests__ -> 4 levels up
  const sddPath = path.resolve(__dirname, '../../../../../docs/SDD.md');
  const sddContent = fs.readFileSync(sddPath, 'utf-8');

  const sectionStart = sddContent.indexOf('### 13.1 Metrics catalogue');
  if (sectionStart === -1) {
    throw new Error('Section "### 13.1 Metrics catalogue" not found in docs/SDD.md');
  }

  const nextSection = sddContent.indexOf('### 13.2', sectionStart);
  const sectionText =
    nextSection !== -1
      ? sddContent.substring(sectionStart, nextSection)
      : sddContent.substring(sectionStart);

  const lines = sectionText.split('\n');
  const metricNames: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    // Table rows start and end with |
    if (!trimmed.startsWith('|') || trimmed.startsWith('|---') || trimmed.includes('| Metric |')) {
      continue;
    }

    const cells = trimmed
      .split('|')
      .map((c) => c.trim())
      .filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);

    if (cells.length > 0 && cells[0]) {
      const metricCell = cells[0];
      // May contain backticks and multiple metric names separated by / (e.g. `storage_ops_total` / `storage_op_duration_seconds`)
      const backtickMatches = metricCell.match(/`([^`]+)`/g);
      if (backtickMatches) {
        for (const match of backtickMatches) {
          const name = match.replace(/`/g, '').trim();
          if (name) metricNames.push(name);
        }
      }
    }
  }

  return metricNames;
}

describe('Metrics Catalogue Conformance (SDD §13.1)', () => {
  it('diffs code registry metrics against SDD §13.1 table with zero missing and zero extra names', async () => {
    const sddMetricNames = parseSddMetricNames();
    expect(sddMetricNames.length).toBeGreaterThan(0);

    const metrics = createMetricsRegistry();
    const registered = await metrics.registry.getMetricsAsJSON();

    const codeMetricNames = registered.map((m) => m.name).filter((name) => !name.startsWith('vp_'));

    const sddSet = new Set(sddMetricNames);
    const codeSet = new Set(codeMetricNames);

    const missingInCode = [...sddSet].filter((x) => !codeSet.has(x));
    const extraInCode = [...codeSet].filter((x) => !sddSet.has(x));

    expect(
      missingInCode,
      `Metrics present in SDD §13.1 but missing in code registry: ${missingInCode.join(', ')}`
    ).toEqual([]);

    expect(
      extraInCode,
      `Metrics present in code registry but missing in SDD §13.1: ${extraInCode.join(', ')}`
    ).toEqual([]);

    expect(codeSet.size).toBe(22);
  });

  it('registers all 22 metrics in the registry', async () => {
    const metrics = createMetricsRegistry();
    const registeredMetrics = await metrics.registry.getMetricsAsJSON();
    expect(registeredMetrics.length).toBeGreaterThanOrEqual(22);
  });

  const EXPECTED_METRICS = [
    {
      name: 'http_request_duration_seconds',
      type: 'histogram',
      labels: ['method', 'route', 'status'],
    },
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
    { name: 'processing_steps_running_stale', type: 'gauge', labels: [] },
    { name: 'time_to_ready_seconds', type: 'histogram', labels: ['bucket'] },
    { name: 'reconciler_repairs_total', type: 'counter', labels: ['type'] },
    { name: 'outbox_drain_duration_seconds', type: 'histogram', labels: [] },
    { name: 'outbox_events_published_total', type: 'counter', labels: ['kind'] },
  ];

  it.each(EXPECTED_METRICS)(
    'metric "$name" has correct type ($type) and labels ($labels)',
    async ({ name, type, labels }) => {
      const metrics = createMetricsRegistry();
      const registeredMetrics = await metrics.registry.getMetricsAsJSON();
      const found = registeredMetrics.find((m) => m.name === name);

      expect(found, `Metric "${name}" must be registered`).toBeDefined();
      expect(String(found?.type).toLowerCase(), `Metric "${name}" type mismatch`).toBe(type);

      const metricInstance = metrics.registry.getSingleMetric(name) as unknown as {
        labelNames?: string[];
      };
      const labelNames = metricInstance?.labelNames ?? [];
      for (const lbl of labels) {
        expect(labelNames, `Metric "${name}" should include label "${lbl}"`).toContain(lbl);
      }
    }
  );

  it('exposes every §13.1 metric on /metrics, and each process series once', async () => {
    const metrics = createMetricsRegistry();

    metrics.httpRequestDuration.observe(
      { method: 'GET', route: '/v1/videos', status: '200' },
      0.05
    );
    metrics.httpRequestsInFlight.set(1);
    metrics.sseConnections.set({ channel_type: 'video' }, 2);
    metrics.sseEventsPublished.inc({ event: 'status' });
    metrics.bullmqQueueJobs.set({ queue: 'probe', state: 'waiting' }, 3);
    metrics.bullmqQueueOldestWaitingAge.set({ queue: 'probe' }, 10);
    metrics.jobsProcessed.inc({ queue: 'probe', result: 'completed' });
    metrics.jobDuration.observe({ queue: 'probe' }, 1.5);
    metrics.jobWaitDuration.observe({ queue: 'probe' }, 0.2);
    metrics.transcodeRealtimeFactor.observe({ rendition: '720p', preset: 'ultrafast' }, 2.5);
    metrics.transcodeOutputBytes.inc({ rendition: '720p' }, 1024);
    metrics.ffmpegExitTotal.inc({ stage: 'probe', code: '0' });
    metrics.storageOpsTotal.inc({ op: 'put', bucket: 'raw', result: 'success' });
    metrics.storageOpDuration.observe({ op: 'put', bucket: 'raw', result: 'success' }, 0.1);
    metrics.workerTmpBytes.set({ stage: 'probe' }, 2048);
    metrics.dlqEntriesTotal.inc({ queue: 'probe', error_code: 'UNSUPPORTED_CODEC' });
    metrics.videosByStatus.set({ status: 'READY' }, 5);
    metrics.processingStepsRunningStale.set(1);
    metrics.timeToReady.observe({ bucket: '<1min' }, 25);

    const server = new MetricsServer({ port: 0, host: '127.0.0.1', registry: metrics.registry });
    expect((await server.listen()).ok).toBe(true);

    try {
      const res = await fetch(`http://127.0.0.1:${server.port}/metrics`);
      expect(res.status).toBe(200);
      const text = await res.text();

      for (const expected of EXPECTED_METRICS) {
        expect(text, `Expected /metrics to expose ${expected.name}`).toContain(expected.name);
      }
      const processSeries = text.match(/^# TYPE \S*process_cpu_seconds_total /gm) ?? [];
      expect(processSeries).toEqual(['# TYPE vp_process_cpu_seconds_total ']);
    } finally {
      await server.close();
    }
  });
});
