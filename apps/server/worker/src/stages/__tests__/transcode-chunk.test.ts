import * as fs from 'node:fs/promises';
import { InMemoryRepositories, InMemoryStorageClient } from '@vp/adapters/in-memory';
import type { QueueJob } from '@vp/core/ports';
import { databaseUnavailable, ErrorCodes, PermanentError } from '@vp/errors';
import type { MediaTools } from '@vp/ffmpeg';
import { CANONICAL_LADDER, type TranscodeJob } from '@vp/job-contracts';
import { createLogger } from '@vp/logger';
import { err, isErr, ok } from '@vp/result';
import { chunkKey } from '@vp/storage';
import { expectOk } from '@vp/testing/result';
import { uuidv7 } from 'uuidv7';
import { STAGE_SETTINGS, transcodeDeps } from '../../__tests__/stage-settings';
import { createTranscodeChunkProcessor } from '../transcode-chunk';

const logger = createLogger({ format: 'json', service: 'chunk-spec', level: 'silent' });

describe('apps/server/worker/stages: transcode chunk', () => {
  let repositories: InMemoryRepositories;
  let storage: InMemoryStorageClient;
  let videoId: string;
  let slices: Array<{ startSeconds: number; durationSeconds: number; sourcePath: string }>;
  let media: MediaTools;

  const job = (chunkIndex: number): QueueJob<TranscodeJob> => ({
    id: `${videoId}--transcode--720p--c${chunkIndex}--g1`,
    name: 'transcode-720p',
    data: {
      videoId,
      sourceKey: 'raw/source.mp4',
      generation: 1,
      rendition: CANONICAL_LADDER[1],
      fps: 24,
      durationMs: 70_000,
      chunkIndex,
      chunkCount: 3,
      traceparent: '00-01',
    },
  });

  const processor = () =>
    createTranscodeChunkProcessor(transcodeDeps({ repositories, storage, logger, media }));

  beforeEach(async () => {
    repositories = new InMemoryRepositories();
    storage = new InMemoryStorageClient();
    videoId = uuidv7();
    slices = [];
    media = {
      ...STAGE_SETTINGS.media,
      transcodeChunk: async (options) => {
        slices.push({
          startSeconds: options.startSeconds,
          durationSeconds: options.durationSeconds,
          sourcePath: options.sourcePath,
        });
        await fs.writeFile(options.outputPath, Buffer.alloc(100));
      },
    };
    expectOk(
      await storage.uploadObject({
        bucket: 'raw',
        key: 'raw/source.mp4',
        body: 'source bytes',
        contentType: 'video/mp4',
      })
    );
  });

  it.each([
    { chunkIndex: 0, startSeconds: 0, durationSeconds: 30 },
    { chunkIndex: 2, startSeconds: 60, durationSeconds: 10 },
  ])(
    'encodes seconds $startSeconds for $durationSeconds from the streamed source',
    async ({ chunkIndex, startSeconds, durationSeconds }) => {
      const result = expectOk(await processor()(job(chunkIndex)));

      expect(result).toMatchObject({ type: 'chunk', chunkIndex, bytes: 100 });
      expect(slices).toEqual([
        { startSeconds, durationSeconds, sourcePath: expect.stringContaining('raw/source.mp4') },
      ]);
    }
  );

  it('stores the chunk under its key and records the step as done', async () => {
    expectOk(await processor()(job(1)));

    const stored = await storage.headObject('raw', chunkKey(videoId, 1, '720p', 1));
    expect(expectOk(stored)?.contentLength).toBe(100);
    const steps = expectOk(await repositories.steps.findByVideoId(videoId));
    expect(steps).toEqual([
      expect.objectContaining({ step: 'transcode-chunk', rendition: '720p--c1', status: 'DONE' }),
    ]);
  });

  it('does not encode a chunk a finished step already covers', async () => {
    expectOk(await processor()(job(1)));
    slices = [];

    expectOk(await processor()(job(1)));

    expect(slices).toEqual([]);
  });

  it('fails the step when the encode fails', async () => {
    media = {
      ...media,
      transcodeChunk: () =>
        Promise.reject(new PermanentError(ErrorCodes.FFMPEG_FAILED, 'chunk encode crashed')),
    };

    const result = await processor()(job(1));

    expect(isErr(result)).toBe(true);
    const steps = expectOk(await repositories.steps.findByVideoId(videoId));
    expect(steps[0]).toMatchObject({ status: 'FAILED', errorCode: ErrorCodes.FFMPEG_FAILED });
  });

  it('retries the chunk when the lease renewal is refused, and uploads nothing', async () => {
    vi.spyOn(repositories.steps, 'heartbeat').mockResolvedValue(
      err(databaseUnavailable('heartbeat'))
    );
    media = {
      ...media,
      transcodeChunk: (options) => {
        options.onProgress?.({ percent: 10, outTimeMs: 3_000 });
        return new Promise((_, reject) => {
          options.signal?.addEventListener('abort', () => reject(new Error('killed')));
        });
      },
    };

    const result = await processor()(job(1));

    expect(result).toEqual(err(expect.objectContaining({ code: ErrorCodes.DATABASE_UNAVAILABLE })));
    expect(await storage.headObject('raw', chunkKey(videoId, 1, '720p', 1))).toEqual(ok(null));
  });
});
