import { InMemoryRepositories, InMemoryStorageClient } from '@vp/adapters/in-memory';
import { CANONICAL_LADDER } from '@vp/ffmpeg';
import type { LadderEntry, PackageJob } from '@vp/job-contracts';
import { createMetricsRegistry } from '@vp/observability';
import { createLogger } from '@vp/logger';
import { renditionPlaylistKey } from '@vp/storage';
import { expectOk } from '@vp/testing/result';
import { uuidv7 } from 'uuidv7';
import { STAGE_SETTINGS } from '../../__tests__/stage-settings';
import { createPackageProcessor, durationBucket } from '../package';

const OWNER_ID = uuidv7();
const [, RENDITION = CANONICAL_LADDER[0] as LadderEntry] = CANONICAL_LADDER;

async function processingVideo(repositories: InMemoryRepositories, storage: InMemoryStorageClient) {
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
      key: renditionPlaylistKey(videoId, RENDITION.name, 1),
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

function packageJob(videoId: string) {
  const data: PackageJob = {
    videoId,
    generation: 1,
    ladder: [RENDITION],
    traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
  };
  return { id: `${videoId}--package--g1`, name: 'package', data, attemptsMade: 0 };
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

  it.each([
    [0, '<1min'],
    [59_999, '<1min'],
    [60_000, '1-5'],
    [300_000, '5-15'],
    [900_000, '15-60'],
    [3_600_000, '15-60'],
  ])('bands a %i ms source as %s', (durationMs, bucket) => {
    expect(durationBucket(durationMs)).toBe(bucket);
  });
});
