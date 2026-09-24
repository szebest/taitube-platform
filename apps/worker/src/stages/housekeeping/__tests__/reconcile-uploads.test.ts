import {
  InMemoryJobQueue,
  InMemoryMultipartStorage,
  InMemoryRepositories,
  InMemoryStorageClient,
} from '@vp/adapters/in-memory';
import { queueUnavailable } from '@vp/errors';
import { type PipelineMetrics, createMetricsRegistry } from '@vp/observability';
import { err } from '@vp/result';
import { expectOk } from '@vp/testing/result';
import { uuidv7 } from 'uuidv7';
import { runReconcileUploads } from '../reconcile-uploads';

const TEN_MINUTES_MS = 10 * 60 * 1000;

describe('housekeeping: reconcile-uploads', () => {
  let repositories: InMemoryRepositories;
  let probeQueue: InMemoryJobQueue;
  let metrics: PipelineMetrics;

  const reconcile = async () =>
    expectOk(
      await runReconcileUploads({
        repositories,
        multipart: new InMemoryMultipartStorage(new InMemoryStorageClient()),
        probeQueue,
        metrics,
        rawBucket: 'raw',
        uploadingThresholdMs: TEN_MINUTES_MS,
        uploadedThresholdMs: 5 * 60 * 1000,
        maxInflightPerUser: 3,
      })
    );

  const repairs = async () =>
    (await metrics.reconcilerRepairsTotal.get()).values.reduce((sum, { value }) => sum + value, 0);

  async function seedLostProbe(): Promise<void> {
    const video = expectOk(
      await repositories.videos.create({
        id: uuidv7(),
        ownerId: uuidv7(),
        sourceKey: 'raw/source.mp4',
        status: 'UPLOADED',
        generation: 1,
      })
    );
    video.updatedAt = new Date(Date.now() - TEN_MINUTES_MS);
  }

  beforeEach(() => {
    repositories = new InMemoryRepositories();
    probeQueue = new InMemoryJobQueue('probe');
    metrics = createMetricsRegistry();
  });

  it('re-enqueues an UPLOADED video whose probe job was lost, and counts the repair', async () => {
    await seedLostProbe();

    expect(await reconcile()).toEqual({ abandonedCount: 0, reenqueuedCount: 1 });
    expect(probeQueue.enqueuedJobs).toHaveLength(1);
    expect(await repairs()).toBe(1);
  });

  it('starts a trace of its own for every repair', async () => {
    await seedLostProbe();
    await seedLostProbe();

    await reconcile();

    const traceIds = probeQueue.enqueuedJobs.map(
      (job) => (job.data as { traceparent: string }).traceparent.split('-')[1]
    );
    expect(traceIds).toHaveLength(2);
    expect(new Set(traceIds).size).toBe(2);
    expect(traceIds).not.toContain('00000000000000000000000000000001');
  });

  it('counts no repair when the probe queue refuses the job', async () => {
    await seedLostProbe();
    vi.spyOn(probeQueue, 'add').mockResolvedValue(err(queueUnavailable('add')));

    expect(await reconcile()).toEqual({ abandonedCount: 0, reenqueuedCount: 0 });
    expect(await repairs()).toBe(0);
  });
});
