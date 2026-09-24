import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { InMemoryRepositories, InMemoryStorageClient } from '@vp/adapters/in-memory';
import { ErrorCodes, storageUnavailable } from '@vp/errors';
import type { MediaTools } from '@vp/ffmpeg';
import { createLogger } from '@vp/observability';
import { err, ok } from '@vp/result';
import { expectErr, expectOk } from '@vp/testing/result';
import { STAGE_SETTINGS, transcodeDeps } from '../../__tests__/stage-settings';
import { createTranscodeProcessor } from '../transcode';
import { exists, fakeEncoder, seedTranscode, transcodeJob } from './uploader-harness';

const logger = createLogger({ service: 'segment-uploader-test', level: 'silent' });

describe('streaming segment uploader', () => {
  let repositories: InMemoryRepositories;
  let storage: InMemoryStorageClient;

  beforeEach(() => {
    repositories = new InMemoryRepositories();
    storage = new InMemoryStorageClient();
  });

  const processorWith = (media?: MediaTools) =>
    createTranscodeProcessor(transcodeDeps({ repositories, storage, logger, media }));

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
    const videoId = await seedTranscode(repositories, storage, { body: Buffer.alloc(50_000, 1) });
    const segmentBytes = 10_000;
    const totalSegments = 12;
    let tmpDir = '';
    let peakBytes = 0;
    const media: MediaTools = {
      ...STAGE_SETTINGS.media,
      transcode: async (opts) => {
        tmpDir = path.dirname(opts.outputDir);
        const sampler = setInterval(async () => {
          try {
            let bytes = 0;
            for (const f of await fs.readdir(opts.outputDir)) {
              bytes += (await fs.stat(path.join(opts.outputDir, f))).size;
            }
            peakBytes = Math.max(peakBytes, bytes);
          } catch {}
        }, 10);
        for (let i = 0; i < totalSegments; i++) {
          const segment = path.join(opts.outputDir, `seg_${String(i).padStart(5, '0')}.ts`);
          await fs.writeFile(`${segment}.tmp`, Buffer.alloc(segmentBytes, 2));
          await new Promise((r) => setTimeout(r, 20));
          await fs.rename(`${segment}.tmp`, segment);
          await new Promise((r) => setTimeout(r, 25));
        }
        const playlistPath = path.join(opts.outputDir, 'index.m3u8');
        await fs.writeFile(
          playlistPath,
          '#EXTM3U\n#EXT-X-VERSION:6\n#EXT-X-PLAYLIST-TYPE:VOD\n#EXT-X-ENDLIST\n'
        );
        clearInterval(sampler);
        return {
          outputDir: opts.outputDir,
          playlistPath,
          segmentCount: totalSegments,
          durationMs: 72_000,
        };
      },
    };

    const result = expectOk(await processorWith(media)(transcodeJob(videoId)));

    expect(result.segmentCount).toBe(totalSegments);
    expect(peakBytes).toBeLessThanOrEqual(4 * segmentBytes + 1000);
    expect(await exists(tmpDir)).toBe(false);
  });

  it('streams every segment and the playlist of a real s60 transcode to storage', async () => {
    const fixture = path.resolve(__dirname, '../../../../../tests/fixtures/s60.mp4');
    const body = await fs.readFile(fixture);
    const videoId = await seedTranscode(repositories, storage, { sourceKey: 'raw/s60.mp4', body });

    const result = expectOk(
      await processorWith()(transcodeJob(videoId, { sourceKey: 'raw/s60.mp4' }))
    );

    expect(result.segmentCount).toBeGreaterThanOrEqual(10);
    expect(result.bytes).toBeGreaterThan(50_000);
    const hls = `videos/${videoId}/hls/720p`;
    for (let i = 0; i < result.segmentCount; i++) {
      const segment = `${hls}/seg_${String(i).padStart(5, '0')}.ts`;
      expect(expectOk(await storage.headObject('public', segment))).not.toBeNull();
    }
    expect(expectOk(await storage.headObject('public', `${hls}/index.m3u8`))).not.toBeNull();
  });
});
