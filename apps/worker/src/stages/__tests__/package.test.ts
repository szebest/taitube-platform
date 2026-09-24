import { InMemoryRepositories, InMemoryStorageClient } from '@vp/adapters/in-memory';
import type { QueueJob } from '@vp/core/ports';
import { ErrorCodes } from '@vp/errors';
import { CANONICAL_LADDER, type LadderEntry, type PackageJob } from '@vp/job-contracts';
import { createLogger } from '@vp/logger';
import { createMetricsRegistry } from '@vp/observability';
import { renditionPlaylistKey } from '@vp/storage';
import { expectErr, expectOk } from '@vp/testing/result';
import { uuidv7 } from 'uuidv7';
import { type FlowWorld, OWNER_ID, flowWorld, rungs } from '../../__tests__/flow-harness';
import { STAGE_SETTINGS } from '../../__tests__/stage-settings';
import { createPackageProcessor } from '../package';

const RENDITION: LadderEntry = CANONICAL_LADDER[1];

async function processingVideo(
  repositories: InMemoryRepositories,
  storage: InMemoryStorageClient,
  generation = 1
) {
  const videoId = uuidv7();
  expectOk(
    await repositories.videos.create({
      id: videoId,
      ownerId: OWNER_ID,
      title: 'packaged',
      status: 'PROCESSING',
      sourceKey: `raw/${videoId}`,
      sourceSizeBytes: 1_000,
      durationMs: 90_000,
    })
  );
  expectOk(
    await storage.uploadObject({
      bucket: STAGE_SETTINGS.publicBucket,
      key: renditionPlaylistKey(videoId, RENDITION.name, generation),
      body: '#EXTM3U\n',
      contentType: 'application/vnd.apple.mpegurl',
    })
  );
  return videoId;
}

async function completedUpload(repositories: InMemoryRepositories, videoId: string) {
  const uploadId = uuidv7();
  expectOk(
    await repositories.uploads.create({
      id: uploadId,
      videoId,
      strategy: 'single',
      declaredSizeBytes: 1_000,
      declaredContentType: 'video/mp4',
      expiresAt: new Date(Date.now() + 60_000),
    })
  );
  const completed = expectOk(await repositories.uploads.updateStatus(uploadId, 'COMPLETED'));
  return completed?.completedAt?.getTime() ?? Number.NaN;
}

function packageJob(videoId: string, generation = 1) {
  const data: PackageJob = {
    videoId,
    generation,
    ladder: [RENDITION],
    traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
  };
  return { id: `${videoId}--package--g${generation}`, name: 'package', data, attemptsMade: 0 };
}

async function observedTimeToReady(metrics: ReturnType<typeof createMetricsRegistry>) {
  const { values } = await metrics.timeToReady.get();
  return {
    count: values.find((v) => v.metricName === 'time_to_ready_seconds_count')?.value ?? 0,
    sum: values.find((v) => v.metricName === 'time_to_ready_seconds_sum')?.value ?? 0,
    bucket: values.find((v) => v.metricName === 'time_to_ready_seconds_count')?.labels.bucket,
  };
}

describe('apps/worker/stages: package', () => {
  let world: FlowWorld;
  let videoId: string;

  const job = (): QueueJob<PackageJob> => ({
    id: `${videoId}--package--g1`,
    name: 'package',
    data: { videoId, generation: 1, ladder: rungs('720p'), traceparent: '00-01-01-01' },
    attemptsMade: 0,
  });

  beforeEach(async () => {
    world = flowWorld();
    videoId = uuidv7();
    expectOk(
      await world.repositories.videos.create({
        id: videoId,
        ownerId: OWNER_ID,
        title: 'Package Video',
        status: 'PROCESSING',
        sourceKey: 'raw/s60.mp4',
        sourceSizeBytes: 5_000_000,
        durationMs: 60_000,
      })
    );
  });

  it('writes the master once the rendition playlist is there, flips the video READY once and enqueues notify', async () => {
    expectOk(
      await world.storage.uploadObject({
        bucket: 'public',
        key: `videos/${videoId}/hls/720p/index.m3u8`,
        body: Buffer.from('#EXTM3U\n'),
        contentType: 'application/vnd.apple.mpegurl',
      })
    );
    const uploaded: string[] = [];
    const upload = world.storage.uploadObject.bind(world.storage);
    vi.spyOn(world.storage, 'uploadObject').mockImplementation(async (options) => {
      uploaded.push(options.key);
      return upload(options);
    });

    const pkg = createPackageProcessor({ ...STAGE_SETTINGS, ...world });
    const masterKey = `videos/${videoId}/hls/master.m3u8`;
    expect(expectOk(await pkg(job())).masterKey).toBe(masterKey);
    expect(uploaded).toContain(masterKey);

    const video = expectOk(await world.repositories.videos.findById(videoId));
    expect(video?.status).toBe('READY');
    expect(video?.masterPlaylistKey).toBe(masterKey);
    expect(video?.readyAt).toBeDefined();

    const events = expectOk(await world.repositories.events.findByVideoId(videoId));
    expect(events.filter((event) => event.type === 'video.ready')).toHaveLength(1);

    expect(world.getQueue('notify').enqueuedJobs.map((notify) => notify.name)).toEqual(['notify']);
  });

  it('fails with SEGMENT_VERIFY_FAILED when a rendition playlist is missing from storage', async () => {
    const pkg = createPackageProcessor({ ...STAGE_SETTINGS, ...world });

    expect(expectErr(await pkg(job())).code).toBe(ErrorCodes.SEGMENT_VERIFY_FAILED);

    const steps = expectOk(await world.repositories.steps.findByVideoId(videoId));
    const step = steps.find((s) => s.step === 'package');
    expect(step?.errorCode).toBe(ErrorCodes.SEGMENT_VERIFY_FAILED);
  });
});

describe('apps/worker/stages: package time to ready', () => {
  const logger = createLogger({ format: 'json', service: 'package-test', level: 'silent' });

  it('measures time to ready from the upload completing, on the clock it was handed', async () => {
    const repositories = new InMemoryRepositories();
    const storage = new InMemoryStorageClient();
    const metrics = createMetricsRegistry();
    const videoId = await processingVideo(repositories, storage);
    const completedAt = await completedUpload(repositories, videoId);
    const processor = createPackageProcessor({
      ...STAGE_SETTINGS,
      repositories,
      storage,
      metrics,
      logger,
      now: () => completedAt + 42_000,
    });

    expectOk(await processor(packageJob(videoId)));

    expect(await observedTimeToReady(metrics)).toEqual({ count: 1, sum: 42, bucket: '1-5' });
  });

  it('observes nothing for a re-processed generation, whose upload completed long before', async () => {
    const repositories = new InMemoryRepositories();
    const storage = new InMemoryStorageClient();
    const metrics = createMetricsRegistry();
    const videoId = await processingVideo(repositories, storage, 2);
    const completedAt = await completedUpload(repositories, videoId);
    const processor = createPackageProcessor({
      ...STAGE_SETTINGS,
      repositories,
      storage,
      metrics,
      logger,
      now: () => completedAt + 86_400_000,
    });

    expectOk(await processor(packageJob(videoId, 2)));

    expect((await observedTimeToReady(metrics)).count).toBe(0);
  });

  it('observes nothing for a video no upload completed, rather than guessing a start', async () => {
    const repositories = new InMemoryRepositories();
    const storage = new InMemoryStorageClient();
    const metrics = createMetricsRegistry();
    const videoId = await processingVideo(repositories, storage);
    const processor = createPackageProcessor({
      ...STAGE_SETTINGS,
      repositories,
      storage,
      metrics,
      logger,
    });

    expectOk(await processor(packageJob(videoId)));

    expect((await observedTimeToReady(metrics)).count).toBe(0);
  });
});
