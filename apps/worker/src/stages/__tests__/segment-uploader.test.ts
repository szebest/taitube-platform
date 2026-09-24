import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { InMemoryRepositories, InMemoryStorageClient } from '@vp/adapters/in-memory';
import { ErrorCodes, storageUnavailable } from '@vp/errors';
import type { MediaTools } from '@vp/ffmpeg';
import { createLogger } from '@vp/logger';
import { err, ok } from '@vp/result';
import { expectErr, expectOk } from '@vp/testing/result';
import { manualInterval } from '../../__tests__/manual-interval';
import { STAGE_SETTINGS, transcodeDeps } from '../../__tests__/stage-settings';
import { StreamingSegmentUploader } from '../segment-uploader';
import { createTranscodeProcessor } from '../transcode';
import { exists, fakeEncoder, seedTranscode, transcodeJob } from './uploader-harness';

const logger = createLogger({ format: 'json', service: 'segment-uploader-test', level: 'silent' });

describe('streaming segment uploader', () => {
  let repositories: InMemoryRepositories;
  let storage: InMemoryStorageClient;

  beforeEach(() => {
    repositories = new InMemoryRepositories();
    storage = new InMemoryStorageClient();
  });

  const processorWith = (media: MediaTools, every = manualInterval().every) =>
    createTranscodeProcessor({
      ...transcodeDeps({ repositories, storage, logger, media }),
      segmentUploader: (target) =>
        new StreamingSegmentUploader({
          storage,
          publicBucket: STAGE_SETTINGS.publicBucket,
          concurrency: 4,
          maxRetries: 3,
          retryDelayMs: 0,
          every,
          ...target,
        }),
    });

  it('retries a transiently failed segment and uploads the playlist last', async () => {
    const videoId = await seedTranscode(repositories, storage);
    const uploaded: string[] = [];
    let failuresLeft = 1;
    const upload = storage.uploadObject.bind(storage);
    vi.spyOn(storage, 'uploadObject').mockImplementation(async (params) => {
      if (params.key.endsWith('seg_00000.ts') && failuresLeft-- > 0) {
        return err(storageUnavailable('uploadObject', 'Simulated transient network glitch'));
      }
      uploaded.push(params.key);
      return upload(params);
    });

    const result = expectOk(await processorWith(fakeEncoder(2))(transcodeJob(videoId)));

    expect(result.segmentCount).toBe(2);
    expect(uploaded).toHaveLength(3);
    expect(uploaded.at(-1)).toContain('index.m3u8');
  });

  it('fails transiently and never writes the playlist when segment uploads keep failing', async () => {
    const videoId = await seedTranscode(repositories, storage);
    vi.spyOn(storage, 'uploadObject').mockImplementation(async (params) =>
      params.key.endsWith('.ts')
        ? err(storageUnavailable('uploadObject', 'Storage bucket unavailable'))
        : ok({ key: params.key })
    );

    const failure = expectErr(await processorWith(fakeEncoder(1))(transcodeJob(videoId)));

    expect(failure.code).toBe(ErrorCodes.STORAGE_UNAVAILABLE);
    expect(
      expectOk(await storage.headObject('public', `videos/${videoId}/hls/720p/index.m3u8`))
    ).toBeNull();
  });

  it('deletes each segment once uploaded, keeping disk usage bounded, and removes the temp dir', async () => {
    const videoId = await seedTranscode(repositories, storage);
    const interval = manualInterval();
    const totalSegments = 12;
    const leftAfterEachPoll: string[][] = [];
    let tmpDir = '';
    const media: MediaTools = {
      ...STAGE_SETTINGS.media,
      transcode: async (opts) => {
        tmpDir = path.dirname(opts.outputDir);
        for (let i = 0; i < totalSegments; i++) {
          const segment = path.join(opts.outputDir, `seg_${String(i).padStart(5, '0')}.ts`);
          await fs.writeFile(`${segment}.tmp`, Buffer.alloc(10_000, 2));
          await fs.rename(`${segment}.tmp`, segment);
          await interval.advance();
          leftAfterEachPoll.push(await fs.readdir(opts.outputDir));
        }
        const playlistPath = path.join(opts.outputDir, 'index.m3u8');
        await fs.writeFile(playlistPath, '#EXTM3U\n#EXT-X-ENDLIST\n');
        return {
          outputDir: opts.outputDir,
          playlistPath,
          segmentCount: totalSegments,
          durationMs: 72_000,
        };
      },
    };

    const result = expectOk(await processorWith(media, interval.every)(transcodeJob(videoId)));

    expect(result.segmentCount).toBe(totalSegments);
    expect(leftAfterEachPoll).toEqual(Array.from({ length: totalSegments }, () => []));
    expect(await exists(tmpDir)).toBe(false);
  });

  it('streams every segment and the playlist of a real s2 transcode to storage', async () => {
    const fixture = path.resolve(__dirname, '../../../../../tests/fixtures/s2.mp4');
    const body = await fs.readFile(fixture);
    const videoId = await seedTranscode(repositories, storage, { sourceKey: 'raw/s2.mp4', body });
    const deps = transcodeDeps({ repositories, storage, logger });
    const processor = createTranscodeProcessor({
      ...deps,
      ffmpeg: { ...deps.ffmpeg, gopSeconds: 0.5, hlsSegmentSeconds: 0.5 },
    });

    const result = expectOk(
      await processor(transcodeJob(videoId, { sourceKey: 'raw/s2.mp4', durationMs: 2000 }))
    );

    expect(result.segmentCount).toBeGreaterThanOrEqual(3);
    expect(result.bytes).toBeGreaterThan(1000);
    const hls = `videos/${videoId}/hls/720p`;
    for (let i = 0; i < result.segmentCount; i++) {
      const segment = `${hls}/seg_${String(i).padStart(5, '0')}.ts`;
      expect(expectOk(await storage.headObject('public', segment))).not.toBeNull();
    }
    expect(expectOk(await storage.headObject('public', `${hls}/index.m3u8`))).not.toBeNull();
  });
});
