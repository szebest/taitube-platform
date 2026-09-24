import {
  InMemoryJobQueue,
  InMemoryMultipartStorage,
  InMemoryRepositories,
  InMemoryStorageClient,
} from '@vp/adapters/in-memory';
import { queueUnavailable } from '@vp/errors';
import { ids } from '@vp/job-contracts';
import { type PipelineMetrics, createMetricsRegistry } from '@vp/observability';
import { err } from '@vp/result';
import { expectOk } from '@vp/testing/result';
import { uuidv7 } from 'uuidv7';
import { runReconcileUploads } from '../reconcile-uploads';
import { hoursAgo, seedVideo } from './housekeeping-harness';

const TEN_MINUTES_MS = 10 * 60 * 1000;

describe('housekeeping: reconcile-uploads', () => {
  let repositories: InMemoryRepositories;
  let multipart: InMemoryMultipartStorage;
  let probeQueue: InMemoryJobQueue;
  let metrics: PipelineMetrics;

  const reconcile = async () =>
    expectOk(
      await runReconcileUploads({
        repositories,
        multipart,
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

  const seedLostProbe = () =>
    seedVideo(repositories, {
      status: 'UPLOADED',
      generation: 1,
      idleSince: new Date(Date.now() - TEN_MINUTES_MS),
    });

  async function seedStaleMultipartUpload(): Promise<{ videoId: string; uploadId: string }> {
    const { id: videoId, sourceKey } = await seedVideo(repositories, {
      status: 'UPLOADING',
      idleSince: hoursAgo(2),
    });
    const uploadId = expectOk(await multipart.createMultipartUpload('raw', sourceKey, 'video/mp4'));
    multipart.seedPart(uploadId, 1, Buffer.from('part 1 content'));
    expectOk(
      await repositories.uploads.create({
        id: uuidv7(),
        videoId,
        strategy: 'multipart',
        status: 'OPEN',
        declaredSizeBytes: 100 * 1024 * 1024,
        declaredContentType: 'video/mp4',
        multipartUploadId: uploadId,
        expiresAt: new Date(Date.now() + 3600 * 1000),
      })
    );
    return { videoId, uploadId };
  }

  const abandonedEvents = async (videoId: string) =>
    expectOk(await repositories.events.findByVideoId(videoId)).filter(
      (event) => event.type === 'video.abandoned'
    );

  beforeEach(() => {
    repositories = new InMemoryRepositories();
    multipart = new InMemoryMultipartStorage(new InMemoryStorageClient());
    probeQueue = new InMemoryJobQueue('probe');
    metrics = createMetricsRegistry();
  });

  it('abandons an upload idle past the threshold and aborts its multipart upload', async () => {
    const { videoId, uploadId } = await seedStaleMultipartUpload();
    const inFlight = async () =>
      expectOk(await multipart.listMultipartUploads('raw')).filter((u) => u.uploadId === uploadId);
    expect(await inFlight()).toHaveLength(1);

    expect(await reconcile()).toEqual({ abandonedCount: 1, reenqueuedCount: 0 });

    expect(expectOk(await repositories.videos.findById(videoId))?.status).toBe('ABANDONED');
    expect(expectOk(await repositories.uploads.findByVideoId(videoId))?.status).toBe('ABORTED');
    expect(await inFlight()).toHaveLength(0);
    expect(await abandonedEvents(videoId)).toHaveLength(1);
  });

  it('leaves an upload that is still inside the threshold alone', async () => {
    const { id: videoId } = await seedVideo(repositories, { status: 'UPLOADING' });

    expect((await reconcile()).abandonedCount).toBe(0);
    expect(expectOk(await repositories.videos.findById(videoId))?.status).toBe('UPLOADING');
  });

  it('abandons a stale upload exactly once when two reconcilers race', async () => {
    const { videoId } = await seedStaleMultipartUpload();

    const [first, second] = await Promise.all([reconcile(), reconcile()]);

    expect(first.abandonedCount + second.abandonedCount).toBe(1);
    expect(expectOk(await repositories.videos.findById(videoId))?.status).toBe('ABANDONED');
    expect(await abandonedEvents(videoId)).toHaveLength(1);
  });

  it('re-enqueues an UPLOADED video whose probe job was lost, and counts the repair', async () => {
    const { id: videoId } = await seedLostProbe();

    expect(await reconcile()).toEqual({ abandonedCount: 0, reenqueuedCount: 1 });
    expect(probeQueue.enqueuedJobs).toHaveLength(1);
    expect(probeQueue.enqueuedJobs[0]?.id).toBe(ids.probe(videoId, 1));
    expect(probeQueue.enqueuedJobs[0]?.data).toMatchObject({ videoId });
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
