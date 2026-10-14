import * as path from 'node:path';
import { InMemoryRepositories, InMemoryStorageClient } from '@vp/adapters/in-memory';
import { ErrorCodes, PermanentError } from '@vp/errors';
import type { MediaTools } from '@vp/ffmpeg';
import { createLogger } from '@vp/logger';
import { captureLog } from '@vp/testing/log-capture';
import { expectErr, expectOk } from '@vp/testing/result';
import { STAGE_SETTINGS, transcodeDeps } from '../../__tests__/stage-settings';
import { createTranscodeProcessor } from '../transcode';
import {
  type EncoderInput,
  exists,
  fakeEncoder,
  seedTranscode,
  transcodeJob,
} from './uploader-harness';

const logger = createLogger({
  format: 'json',
  service: 'uploader-encode-attempt-test',
  level: 'silent',
});

describe('transcode attempt around the segment uploader', () => {
  let repositories: InMemoryRepositories;
  let storage: InMemoryStorageClient;

  beforeEach(() => {
    repositories = new InMemoryRepositories();
    storage = new InMemoryStorageClient();
  });

  it.each([1, 2])(
    'backs FFmpeg threads off to one on a retry after %i failed attempts',
    async (attemptsMade) => {
      const videoId = await seedTranscode(repositories, storage);
      const log = captureLog();
      const recorded = createLogger({
        format: 'json',
        service: 'uploader-encode-attempt-test',
        level: 'info',
        destination: log.destination,
      });
      const seen: EncoderInput = {};
      const processor = createTranscodeProcessor(
        transcodeDeps({ repositories, storage, logger: recorded, media: fakeEncoder(1, seen) })
      );

      await processor(transcodeJob(videoId, { attemptsMade }));

      expect(STAGE_SETTINGS.ffmpeg.threads).toBe(2);
      expect(seen.threads).toBe(1);
      expect(log.lines()).toContainEqual(
        expect.objectContaining({
          attempt: attemptsMade + 1,
          threads: 1,
          msg: 'transcode attempt starting',
        })
      );
    }
  );

  it('transcodes from a presigned URL without downloading the source', async () => {
    const videoId = await seedTranscode(repositories, storage, {
      body: Buffer.from('mock-source-data'),
    });
    const presign = vi.spyOn(storage, 'createPresignedGetUrl');
    const download = vi.spyOn(storage, 'downloadObject');
    const seen: EncoderInput = {};
    const processor = createTranscodeProcessor(
      transcodeDeps({ repositories, storage, logger, media: fakeEncoder(1, seen) })
    );

    const result = expectOk(await processor(transcodeJob(videoId, { streamingInput: true })));

    expect(presign).toHaveBeenCalledWith({
      bucket: 'raw',
      key: 'raw/source.mp4',
      expiresInSeconds: 7200,
    });
    expect(download).not.toHaveBeenCalled();
    expect(seen.sourcePath).toContain('http://localhost:9000/raw/raw/source.mp4');
    expect(result.segmentCount).toBe(1);
    const renditions = expectOk(await repositories.renditions.findByVideoId(videoId));
    expect(renditions[0]?.status).toBe('DONE');
  });

  it.each([
    {
      failure: 'ENOSPC',
      error: Object.assign(new Error('write error: No space left on device'), { code: 'ENOSPC' }),
      code: ErrorCodes.DISK_FULL,
    },
    {
      failure: 'a crashed encode',
      error: new PermanentError(ErrorCodes.FFMPEG_FAILED, 'FFmpeg failed for transcode-720p'),
      code: ErrorCodes.FFMPEG_FAILED,
    },
  ])('fails the step with $code on $failure and removes the temp dir', async (encode) => {
    const videoId = await seedTranscode(repositories, storage);
    let tmpDir = '';
    const media: MediaTools = {
      ...STAGE_SETTINGS.media,
      transcode: (opts) => {
        tmpDir = path.dirname(opts.outputDir);
        return Promise.reject(encode.error);
      },
    };
    const processor = createTranscodeProcessor(
      transcodeDeps({ repositories, storage, logger, media })
    );

    expect(expectErr(await processor(transcodeJob(videoId)))).toMatchObject({
      code: encode.code,
      stage: 'transcode-720p',
    });
    const steps = expectOk(await repositories.steps.findByVideoId(videoId));
    expect(steps.find((s) => s.step === 'transcode')).toMatchObject({
      status: 'FAILED',
      errorCode: encode.code,
    });
    expect(tmpDir).not.toBe('');
    expect(await exists(tmpDir)).toBe(false);
  });
});
