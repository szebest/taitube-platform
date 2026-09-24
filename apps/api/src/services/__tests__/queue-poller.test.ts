import { InMemoryJobQueue } from '@vp/adapters/in-memory';
import type { JobQueue } from '@vp/core/ports';
import { queueUnavailable } from '@vp/errors';
import { createMetricsRegistry } from '@vp/observability';
import { err } from '@vp/result';
import { pollQueueMetrics } from '../queue-poller';

async function gauge(metrics: ReturnType<typeof createMetricsRegistry>, name: string) {
  const all = await metrics.registry.getMetricsAsJSON();
  return all.find((metric) => metric.name === name)?.values ?? [];
}

describe('apps/api/services: pollQueueMetrics', () => {
  it('records the job counts of every queue it is given', async () => {
    const probe = new InMemoryJobQueue('probe');
    await probe.add('probe', { videoId: 'v1' });
    const metrics = createMetricsRegistry();

    await pollQueueMetrics(new Map<string, JobQueue>([['probe', probe]]), metrics, Date.now);

    const waiting = (await gauge(metrics, 'bullmq_queue_jobs')).find(
      (sample) => sample.labels.queue === 'probe' && sample.labels.state === 'waiting'
    );
    expect(waiting?.value).toBe(1);
  });

  it('counts a job with a priority as prioritized, which is where BullMQ keeps it', async () => {
    const probe = new InMemoryJobQueue('probe');
    await probe.add('probe', { videoId: 'v1' }, { priority: 5 });
    const metrics = createMetricsRegistry();

    await pollQueueMetrics(new Map<string, JobQueue>([['probe', probe]]), metrics, Date.now);

    const samples = await gauge(metrics, 'bullmq_queue_jobs');
    expect(samples.find((sample) => sample.labels.state === 'prioritized')?.value).toBe(1);
    expect(samples.find((sample) => sample.labels.state === 'waiting')?.value).toBe(0);
  });

  it('ages the oldest job not started, prioritized ones included, past the starvation alert', async () => {
    const start = Date.UTC(2026, 0, 1);
    vi.useFakeTimers({ now: start });
    const probe = new InMemoryJobQueue('probe');
    await probe.add('probe', { videoId: 'first' }, { priority: 5 });
    vi.setSystemTime(start + 60_000);
    await probe.add('probe', { videoId: 'second' });
    vi.useRealTimers();
    const metrics = createMetricsRegistry();

    const now = () => start + 901_000;
    await pollQueueMetrics(new Map<string, JobQueue>([['probe', probe]]), metrics, now);

    const [age] = await gauge(metrics, 'bullmq_queue_oldest_waiting_age_seconds');
    const starvationThresholdSeconds = 900;
    expect(age?.value).toBe(901);
    expect(age?.value).toBeGreaterThan(starvationThresholdSeconds);
  });

  it('costs an unreachable queue its own sample and nothing else', async () => {
    const broken = Object.assign(new InMemoryJobQueue('probe'), {
      getJobCounts: async () => err(queueUnavailable('getJobCounts')),
      getJobs: async () => err(queueUnavailable('getJobs')),
    });
    const healthy = new InMemoryJobQueue('notify');
    await healthy.add('notify', { videoId: 'v1' });
    const metrics = createMetricsRegistry();

    await pollQueueMetrics(
      new Map<string, JobQueue>([
        ['probe', broken],
        ['notify', healthy],
      ]),
      metrics,
      Date.now
    );

    const samples = await gauge(metrics, 'bullmq_queue_jobs');
    expect(samples.some((sample) => sample.labels.queue === 'probe')).toBe(false);
    expect(samples.some((sample) => sample.labels.queue === 'notify')).toBe(true);
    const age = (await gauge(metrics, 'bullmq_queue_oldest_waiting_age_seconds')).find(
      (sample) => sample.labels.queue === 'probe'
    );
    expect(age?.value).toBe(0);
  });
});
