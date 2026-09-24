import { InMemoryJobQueue, InMemoryRepositories } from '@vp/adapters/in-memory';
import { queueUnavailable } from '@vp/errors';
import { ids } from '@vp/job-contracts';
import { type PipelineMetrics, createMetricsRegistry } from '@vp/observability';
import { err } from '@vp/result';
import { expectOk } from '@vp/testing/result';
import { uuidv7 } from 'uuidv7';
import { OutboxRelay } from '../outbox-relay';
import { inMemoryQueues, queueOutboxEntry } from './housekeeping-harness';

const BATCH_SIZE = 50;

describe('housekeeping: outbox relay', () => {
  let repositories: InMemoryRepositories;
  let getQueue: (name: string) => InMemoryJobQueue;
  let metrics: PipelineMetrics;

  const drain = async (queues: (name: string) => InMemoryJobQueue = getQueue) =>
    expectOk(
      await new OutboxRelay({
        repositories,
        getQueue: queues,
        metrics,
        batchSize: BATCH_SIZE,
        intervalMs: 60_000,
      }).drainOnce()
    );

  const enqueueProbe = async (videoId: string, data: object = {}) =>
    expectOk(
      await repositories.outbox.enqueue(
        queueOutboxEntry('probe', { videoId, generation: 1, ...data }, ids.probe(videoId, 1))
      )
    );

  beforeEach(() => {
    repositories = new InMemoryRepositories();
    getQueue = inMemoryQueues();
    metrics = createMetricsRegistry();
  });

  it('publishes pending entries to their queue and marks them published', async () => {
    const videoId = uuidv7();
    await enqueueProbe(videoId, { sourceKey: 'raw/v.mp4', traceparent: 'tp' });
    expect(getQueue('probe').enqueuedJobs).toHaveLength(0);

    expect(await drain()).toEqual({ processedCount: 1, successCount: 1, failureCount: 0 });

    expect(getQueue('probe').enqueuedJobs.map((job) => job.id)).toEqual([ids.probe(videoId, 1)]);
    expect((await drain()).processedCount).toBe(0);
  });

  it('records an attempt and keeps the entry pending when the queue is unavailable', async () => {
    await repositories.outbox.enqueue(queueOutboxEntry('non_existent_queue'));
    const unavailable = new InMemoryJobQueue('non_existent_queue');
    vi.spyOn(unavailable, 'add').mockResolvedValue(err(queueUnavailable('add')));

    expect(await drain(() => unavailable)).toEqual({
      processedCount: 1,
      successCount: 0,
      failureCount: 1,
    });
    expect(expectOk(await repositories.outbox.claimBatch(10))[0]?.attempts).toBe(1);
  });

  it('publishes the probe committed with a transition even when the direct enqueue never ran', async () => {
    const { id: videoId, sourceKey } = expectOk(
      await repositories.videos.create({
        id: uuidv7(),
        ownerId: uuidv7(),
        sourceKey: 'raw/source.mp4',
        status: 'UPLOADING',
      })
    );
    const probeJobId = ids.probe(videoId, 1);
    const entry = queueOutboxEntry('probe', { videoId, sourceKey, generation: 1 }, probeJobId);
    expect(
      expectOk(
        await repositories.videos.transition({
          videoId,
          from: 'UPLOADING',
          to: 'UPLOADED',
          eventType: 'upload.completed',
          eventPayload: { sizeBytes: 1024 },
          outbox: entry,
        })
      )
    ).toBe(true);
    expect(getQueue('probe').enqueuedJobs).toHaveLength(0);

    expect((await drain()).successCount).toBe(1);
    expect(getQueue('probe').enqueuedJobs.map((job) => job.id)).toEqual([probeJobId]);
  });

  it('treats a job the fast path already enqueued as published, without a duplicate', async () => {
    const videoId = uuidv7();
    await getQueue('probe').add(
      'probe',
      { videoId, generation: 1 },
      { jobId: ids.probe(videoId, 1) }
    );
    await enqueueProbe(videoId);

    expect((await drain()).successCount).toBe(1);
    expect(getQueue('probe').enqueuedJobs).toHaveLength(1);
  });

  it('counts no reconciler repair when the relay delivers normally', async () => {
    await enqueueProbe(uuidv7());

    await drain();

    const repairs = (await metrics.reconcilerRepairsTotal.get()).values;
    expect(repairs.reduce((sum, { value }) => sum + value, 0)).toBe(0);
  });

  it('drains a batch of twenty entries in under a second', async () => {
    for (let i = 0; i < 20; i += 1) await enqueueProbe(uuidv7());

    const start = Date.now();
    const drained = await drain();

    expect(drained.successCount).toBe(20);
    expect(Date.now() - start).toBeLessThan(1000);
  });

  it('runs its timer loop until stopped', async () => {
    const relay = new OutboxRelay({
      repositories,
      getQueue,
      metrics,
      batchSize: BATCH_SIZE,
      intervalMs: 50,
    });

    relay.start();
    expect(relay.isRunning()).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 120));
    await relay.stop();
    expect(relay.isRunning()).toBe(false);
  });
});
