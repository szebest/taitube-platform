import { InMemoryRepositories } from '@vp/adapters/in-memory';
import { inProcessAppConfig } from '@vp/env-schema';
import { createMetricsRegistry } from '@vp/observability';
import { SEEDED } from '@vp/testing';
import { pollSqlMetrics } from '../sql-poller';

const OWNER_ID = SEEDED.userId;

describe('apps/api/services: SQL poller', () => {
  it('records videos_by_status and processing_steps_running_stale', async () => {
    const testRepos = new InMemoryRepositories();
    const testMetrics = createMetricsRegistry();

    await testRepos.videos.create({
      id: '00000000-0000-7000-8000-000000000101',
      ownerId: OWNER_ID,
      title: 'Poller Test',
      visibility: 'public',
      status: 'PROCESSING',
      sourceKey: 'raw/poller-test/source.mp4',
    });

    await testRepos.steps.claim({
      id: '00000000-0000-7000-8000-000000000201',
      videoId: '00000000-0000-7000-8000-000000000101',
      step: 'transcode',
      rendition: '720p',
      jobId: 'job-fresh',
      attempt: 1,
      workerId: 'worker-1',
      lockToken: '00000000-0000-7000-8000-000000000301',
    });

    await testRepos.steps.claim({
      id: '00000000-0000-7000-8000-000000000202',
      videoId: '00000000-0000-7000-8000-000000000101',
      step: 'transcode',
      rendition: '1080p',
      jobId: 'job-stale',
      attempt: 1,
      workerId: 'worker-2',
      lockToken: '00000000-0000-7000-8000-000000000302',
    });

    const staleTime = new Date(Date.now() - 10 * 60 * 1000);
    const internalStep = (
      testRepos.steps as unknown as { stepsMap: Map<string, unknown> }
    ).stepsMap.get('00000000-0000-7000-8000-000000000101:transcode:1080p') as {
      heartbeatAt: Date;
      startedAt: Date;
    };
    internalStep.heartbeatAt = staleTime;
    internalStep.startedAt = staleTime;

    await pollSqlMetrics(testRepos, testMetrics, inProcessAppConfig().pollers.staleStepMs);

    const metricsJson = await testMetrics.registry.getMetricsAsJSON();
    const staleMetric = metricsJson.find((m) => m.name === 'processing_steps_running_stale');
    expect(staleMetric?.values[0]?.value).toBe(1);

    const statusMetric = metricsJson.find((m) => m.name === 'videos_by_status');
    const processingVal = statusMetric?.values.find((v) => v.labels.status === 'PROCESSING');
    expect(processingVal?.value).toBe(1);
  });
});
