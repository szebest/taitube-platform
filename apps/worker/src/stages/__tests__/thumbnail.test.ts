import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { InMemoryRepositories, InMemoryStorageClient } from '@vp/adapters/in-memory';
import type { QueueJob } from '@vp/core/ports';
import type { ThumbnailJob } from '@vp/job-contracts';
import { createLogger } from '@vp/observability';
import { expectErr, expectOk } from '@vp/testing/result';
import { uuidv7 } from 'uuidv7';
import { STAGE_SETTINGS } from '../../__tests__/stage-settings';
import { createThumbnailProcessor } from '../thumbnail';

const logger = createLogger({ service: 'thumbnail-test', level: 'silent' });
const IMMUTABLE = 'public, max-age=31536000, immutable';

describe('thumbnail stage', () => {
  let repositories: InMemoryRepositories;
  let storage: InMemoryStorageClient;

  beforeEach(() => {
    repositories = new InMemoryRepositories();
    storage = new InMemoryStorageClient();
  });

  async function processingVideo(sourceKey: string): Promise<string> {
    const videoId = uuidv7();
    await repositories.videos.create({
      id: videoId,
      ownerId: '00000000-0000-7000-8000-000000000001',
      title: 'Thumbnail Video',
      status: 'PROCESSING',
      sourceKey,
      durationMs: 60_000,
      width: 1920,
      height: 1080,
    });
    return videoId;
  }

  function thumbnailJob(videoId: string, sourceKey: string): QueueJob<ThumbnailJob> {
    return {
      id: `${videoId}--thumbnail--g1`,
      name: 'thumbnail',
      data: { videoId, sourceKey, generation: 1, durationMs: 60_000, traceparent: '00-01-01-01' },
      attemptsMade: 0,
    };
  }

  const processor = () =>
    createThumbnailProcessor({ ...STAGE_SETTINGS, repositories, storage, logger });

  it('uploads an immutable poster, a sprite and a VTT of about twelve cues for s60', async () => {
    const fixture = path.resolve(__dirname, '../../../../../tests/fixtures/s60.mp4');
    const videoId = await processingVideo('raw/s60.mp4');
    await storage.uploadObject({
      bucket: 'raw',
      key: 'raw/s60.mp4',
      body: await fs.readFile(fixture),
      contentType: 'video/mp4',
    });

    const result = expectOk(await processor()(thumbnailJob(videoId, 'raw/s60.mp4')));

    expect(result).toMatchObject({
      posterKey: `videos/${videoId}/thumbs/poster.jpg`,
      spriteKey: `videos/${videoId}/thumbs/sprite.jpg`,
      spriteVttKey: `videos/${videoId}/thumbs/sprite.vtt`,
    });
    for (const [key, contentType] of [
      [result.posterKey, 'image/jpeg'],
      [result.spriteKey, 'image/jpeg'],
      [result.spriteVttKey, 'text/vtt'],
    ] as const) {
      expect(expectOk(await storage.headObject('public', key))).toMatchObject({
        contentType,
        cacheControl: IMMUTABLE,
      });
    }
    const vtt = expectOk(await storage.getObject('public', result.spriteVttKey));
    const timings = vtt
      .toString('utf-8')
      .split('\n')
      .filter((line) => line.includes(' --> '));
    expect(timings.length).toBeGreaterThanOrEqual(11);
    expect(timings.length).toBeLessThanOrEqual(13);
    expect(expectOk(await repositories.videos.findById(videoId))).toMatchObject({
      posterKey: result.posterKey,
      spriteKey: result.spriteKey,
    });
    const steps = expectOk(await repositories.steps.findByVideoId(videoId));
    const thumbStep = steps.find((s) => s.step === 'thumbnail');
    expect(thumbStep?.status).toBe('DONE');
    expect(thumbStep?.lockToken).toBeDefined();
    expect(thumbStep?.finishedAt).toBeDefined();
  });

  it('fails the thumbnail step with SOURCE_MISSING when the source object is gone', async () => {
    const videoId = await processingVideo('raw/missing.mp4');

    const failure = expectErr(await processor()(thumbnailJob(videoId, 'raw/missing.mp4')));

    expect(failure.message).toMatch(/Source object not found/);
    const steps = expectOk(await repositories.steps.findByVideoId(videoId));
    const thumbStep = steps.find((s) => s.step === 'thumbnail');
    expect(thumbStep?.status).toBe('FAILED');
    expect(thumbStep?.errorCode).toBe('SOURCE_MISSING');
  });
});
