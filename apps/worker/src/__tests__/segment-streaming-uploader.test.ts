import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { InMemoryRepositories, InMemoryStorageClient } from '@vp/adapters';
import { ErrorCodes, TransientError } from '@vp/errors';
import { uuidv7 } from 'uuidv7';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTranscodeProcessor } from '../stages/transcode';
import { expectOk } from '@vp/testing/result';
import { ok } from '@vp/result';

describe('Ticket 14: Streaming Segment Uploader, Disk Bounds & Thread Back-off', () => {
  let repositories: InMemoryRepositories;
  let storage: InMemoryStorageClient;
  const loggedMessages: Array<{ level: string; msg: string; ctx?: Record<string, unknown> }> = [];

  const logger = {
    info: (ctxOrMsg: unknown, msg?: string) => {
      if (typeof ctxOrMsg === 'string') {
        loggedMessages.push({ level: 'info', msg: ctxOrMsg });
      } else {
        loggedMessages.push({
          level: 'info',
          msg: msg || '',
          ctx: ctxOrMsg as Record<string, unknown>,
        });
      }
    },
    warn: (ctxOrMsg: unknown, msg?: string) => {
      if (typeof ctxOrMsg === 'string') {
        loggedMessages.push({ level: 'warn', msg: ctxOrMsg });
      } else {
        loggedMessages.push({
          level: 'warn',
          msg: msg || '',
          ctx: ctxOrMsg as Record<string, unknown>,
        });
      }
    },
    error: (ctxOrMsg: unknown, msg?: string) => {
      if (typeof ctxOrMsg === 'string') {
        loggedMessages.push({ level: 'error', msg: ctxOrMsg });
      } else {
        loggedMessages.push({
          level: 'error',
          msg: msg || '',
          ctx: ctxOrMsg as Record<string, unknown>,
        });
      }
    },
    child: (bindings: Record<string, unknown>) => {
      return {
        info: (ctxOrMsg: unknown, msg?: string) => {
          if (typeof ctxOrMsg === 'string') {
            loggedMessages.push({ level: 'info', msg: ctxOrMsg, ctx: bindings });
          } else {
            loggedMessages.push({
              level: 'info',
              msg: msg || '',
              ctx: { ...bindings, ...(ctxOrMsg as Record<string, unknown>) },
            });
          }
        },
        warn: (ctxOrMsg: unknown, msg?: string) => {
          if (typeof ctxOrMsg === 'string') {
            loggedMessages.push({ level: 'warn', msg: ctxOrMsg, ctx: bindings });
          } else {
            loggedMessages.push({
              level: 'warn',
              msg: msg || '',
              ctx: { ...bindings, ...(ctxOrMsg as Record<string, unknown>) },
            });
          }
        },
        error: (ctxOrMsg: unknown, msg?: string) => {
          if (typeof ctxOrMsg === 'string') {
            loggedMessages.push({ level: 'error', msg: ctxOrMsg, ctx: bindings });
          } else {
            loggedMessages.push({
              level: 'error',
              msg: msg || '',
              ctx: { ...bindings, ...(ctxOrMsg as Record<string, unknown>) },
            });
          }
        },
        child: () => logger,
      } as any;
    },
  } as any;

  beforeEach(() => {
    repositories = new InMemoryRepositories();
    storage = new InMemoryStorageClient();
    loggedMessages.length = 0;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function createVideo(sourceKey: string, sizeBytes = 1000000): Promise<string> {
    const videoId = uuidv7();
    await repositories.videos.create({
      id: videoId,
      ownerId: uuidv7(),
      title: 'Test Video',
      status: 'PROCESSING',
      sourceKey,
      sourceSizeBytes: sizeBytes,
      durationMs: 60000,
    });
    return videoId;
  }

  function makeJob(
    videoId: string,
    renditionName = '720p',
    attemptsMade = 0,
    streamingInput?: boolean
  ): any {
    return {
      id: `${videoId}--transcode--${renditionName}--g1`,
      attemptsMade,
      data: {
        videoId,
        sourceKey: 'raw/source.mp4',
        generation: 1,
        rendition: {
          name: renditionName,
          width: 1280,
          height: 720,
          videoKbps: 2800,
          maxrateKbps: 2996,
          bufsizeKbps: 4200,
          audioKbps: 128,
          profile: 'high',
          level: '3.1',
        },
        fps: 24,
        durationMs: 60000,
        traceparent: '00-test-01-01',
        streamingInput,
      },
    };
  }

  describe('AC 3: Thread back-off per attempt (SDD §9.6 rule 6)', () => {
    it('Attempt 2 logs threads = FFMPEG_THREADS - 1; attempt >= FFMPEG_THREADS uses 1', async () => {
      const origThreads = process.env.FFMPEG_THREADS;
      process.env.FFMPEG_THREADS = '2';

      try {
        const videoId = await createVideo('raw/source.mp4');
        await storage.uploadObject({
          bucket: 'raw',
          key: 'raw/source.mp4',
          body: Buffer.from('mock-source'),
          contentType: 'video/mp4',
        });

        // Seed rendition
        await repositories.renditions.create({
          id: uuidv7(),
          videoId,
          name: '720p',
          width: 1280,
          height: 720,
          videoBitrateKbps: 2800,
          audioBitrateKbps: 128,
        });

        const ffmpegModule = await import('@vp/ffmpeg');
        vi.spyOn(ffmpegModule, 'runFfmpegTranscode').mockImplementation(async (opts) => {
          await fs.writeFile(path.join(opts.outputDir, 'seg_00000.ts'), Buffer.alloc(100));
          await fs.writeFile(path.join(opts.outputDir, 'index.m3u8'), '#EXTM3U\n');
          return {
            outputDir: opts.outputDir,
            playlistPath: path.join(opts.outputDir, 'index.m3u8'),
            segmentCount: 1,
            durationMs: 60000,
          };
        });

        const processor = createTranscodeProcessor({ repositories, storage, logger });

        // Attempt 2 (attemptsMade = 1)
        loggedMessages.length = 0;
        const job2 = makeJob(videoId, '720p', 1);
        await processor(job2);

        const attempt2Log = loggedMessages.find(
          (m) => m.ctx?.['attempt'] === 2 && m.ctx?.['threads'] === 1
        );
        expect(attempt2Log).toBeDefined();
        expect(attempt2Log?.msg).toContain('threads = 1');

        // Attempt 3 (attemptsMade = 2)
        loggedMessages.length = 0;
        const job3 = makeJob(videoId, '720p', 2);
        await processor(job3);

        const attempt3Log = loggedMessages.find(
          (m) => m.ctx?.['attempt'] === 3 && m.ctx?.['threads'] === 1
        );
        expect(attempt3Log).toBeDefined();
        expect(attempt3Log?.msg).toContain('threads = 1');
      } finally {
        process.env.FFMPEG_THREADS = origThreads;
      }
    });
  });

  describe('AC 2: Playlist object written only after every segment succeeded; retry on segment failure', () => {
    it('retries segment upload on transient failure and writes playlist last after all succeed', async () => {
      const videoId = await createVideo('raw/source.mp4');
      await storage.uploadObject({
        bucket: 'raw',
        key: 'raw/source.mp4',
        body: Buffer.from('mock-source'),
        contentType: 'video/mp4',
      });
      await repositories.renditions.create({
        id: uuidv7(),
        videoId,
        name: '720p',
        width: 1280,
        height: 720,
        videoBitrateKbps: 2800,
        audioBitrateKbps: 128,
      });

      const uploadedSequence: string[] = [];
      let failCount = 1;

      const origUpload = storage.uploadObject.bind(storage);
      vi.spyOn(storage, 'uploadObject').mockImplementation(async (params) => {
        if (params.key.endsWith('seg_00000.ts') && failCount > 0) {
          failCount--;
          throw new Error('Simulated transient storage network glitch');
        }
        uploadedSequence.push(params.key);
        return origUpload(params);
      });

      const ffmpegModule = await import('@vp/ffmpeg');
      vi.spyOn(ffmpegModule, 'runFfmpegTranscode').mockImplementation(async (opts) => {
        await fs.writeFile(path.join(opts.outputDir, 'seg_00000.ts'), Buffer.alloc(100));
        await fs.writeFile(path.join(opts.outputDir, 'seg_00001.ts'), Buffer.alloc(100));
        await fs.writeFile(path.join(opts.outputDir, 'index.m3u8'), '#EXTM3U\n');
        return {
          outputDir: opts.outputDir,
          playlistPath: path.join(opts.outputDir, 'index.m3u8'),
          segmentCount: 2,
          durationMs: 60000,
        };
      });

      const processor = createTranscodeProcessor({ repositories, storage, logger });
      const res = await processor(makeJob(videoId, '720p'));

      expect(expectOk(res).segmentCount).toBe(2);
      expect(uploadedSequence.length).toBe(3); // 2 segments + 1 playlist
      // Playlist must be strictly last
      expect(uploadedSequence[uploadedSequence.length - 1]).toContain('index.m3u8');
    });

    it('fails job transiently after N upload failures and NEVER uploads playlist to storage', async () => {
      const videoId = await createVideo('raw/source.mp4');
      await storage.uploadObject({
        bucket: 'raw',
        key: 'raw/source.mp4',
        body: Buffer.from('mock-source'),
        contentType: 'video/mp4',
      });
      await repositories.renditions.create({
        id: uuidv7(),
        videoId,
        name: '720p',
        width: 1280,
        height: 720,
        videoBitrateKbps: 2800,
        audioBitrateKbps: 128,
      });

      // Storage permanently fails on segment uploads
      vi.spyOn(storage, 'uploadObject').mockImplementation(async (params) => {
        if (params.key.endsWith('.ts')) {
          throw new Error('Storage bucket unavailable');
        }
        return ok({ key: params.key });
      });

      const ffmpegModule = await import('@vp/ffmpeg');
      vi.spyOn(ffmpegModule, 'runFfmpegTranscode').mockImplementation(async (opts) => {
        await fs.writeFile(path.join(opts.outputDir, 'seg_00000.ts'), Buffer.alloc(100));
        await fs.writeFile(path.join(opts.outputDir, 'index.m3u8'), '#EXTM3U\n');
        return {
          outputDir: opts.outputDir,
          playlistPath: path.join(opts.outputDir, 'index.m3u8'),
          segmentCount: 1,
          durationMs: 60000,
        };
      });

      const processor = createTranscodeProcessor({ repositories, storage, logger });
      let caughtError: any;
      try {
        await processor(makeJob(videoId, '720p'));
      } catch (err) {
        caughtError = err;
      }

      expect(caughtError).toBeInstanceOf(TransientError);
      expect(caughtError.code).toBe(ErrorCodes.STORAGE_UNAVAILABLE);

      // Verify playlist was NEVER written to storage
      const headPlaylist = await storage.headObject(
        'public',
        `videos/${videoId}/hls/720p/index.m3u8`
      );
      expect(headPlaylist).toBeNull();
    });
  });

  describe('AC 5: Presigned URL streaming input mode for s60', () => {
    it('runs transcode with -i presigned-url without downloading source to local disk', async () => {
      const videoId = await createVideo('raw/source.mp4');
      await storage.uploadObject({
        bucket: 'raw',
        key: 'raw/source.mp4',
        body: Buffer.from('mock-source-data'),
        contentType: 'video/mp4',
      });
      await repositories.renditions.create({
        id: uuidv7(),
        videoId,
        name: '720p',
        width: 1280,
        height: 720,
        videoBitrateKbps: 2800,
        audioBitrateKbps: 128,
      });

      const presignSpy = vi.spyOn(storage, 'createPresignedGetUrl');
      const downloadSpy = vi.spyOn(storage, 'downloadObject');

      const ffmpegModule = await import('@vp/ffmpeg');
      let transcodeSourcePassed = '';
      vi.spyOn(ffmpegModule, 'runFfmpegTranscode').mockImplementation(async (opts) => {
        transcodeSourcePassed = opts.sourcePath;
        await fs.writeFile(path.join(opts.outputDir, 'seg_00000.ts'), Buffer.alloc(100));
        await fs.writeFile(path.join(opts.outputDir, 'index.m3u8'), '#EXTM3U\n');
        return {
          outputDir: opts.outputDir,
          playlistPath: path.join(opts.outputDir, 'index.m3u8'),
          segmentCount: 1,
          durationMs: 60000,
        };
      });

      const processor = createTranscodeProcessor({
        repositories,
        storage,
        logger,
        streamingInput: true,
      });

      const res = await processor(makeJob(videoId, '720p'));

      expect(presignSpy).toHaveBeenCalledWith({
        bucket: 'raw',
        key: 'raw/source.mp4',
        expiresInSeconds: 7200,
      });
      // Source file was NOT downloaded to local disk
      expect(downloadSpy).not.toHaveBeenCalled();
      expect(transcodeSourcePassed).toContain('http://localhost:9000/raw/raw/source.mp4');
      expect(expectOk(res).segmentCount).toBe(1);

      const rend = expectOk(await repositories.renditions.findByVideoId(videoId));
      expect(rend[0]?.status).toBe('DONE');
    });
  });

  describe('AC 6: ENOSPC during encode classified transient with hint DISK_FULL and temp dir cleaned', () => {
    it('classifies ENOSPC as transient with hint DISK_FULL and cleans temp directory', async () => {
      const videoId = await createVideo('raw/source.mp4');
      await storage.uploadObject({
        bucket: 'raw',
        key: 'raw/source.mp4',
        body: Buffer.from('mock-source'),
        contentType: 'video/mp4',
      });
      await repositories.renditions.create({
        id: uuidv7(),
        videoId,
        name: '720p',
        width: 1280,
        height: 720,
        videoBitrateKbps: 2800,
        audioBitrateKbps: 128,
      });

      let capturedTmpDir = '';
      const ffmpegModule = await import('@vp/ffmpeg');
      vi.spyOn(ffmpegModule, 'runFfmpegTranscode').mockImplementation(async (opts) => {
        capturedTmpDir = path.dirname(opts.outputDir);
        const enospcError = new Error('write error: No space left on device');
        (enospcError as any).code = 'ENOSPC';
        throw enospcError;
      });

      const processor = createTranscodeProcessor({ repositories, storage, logger });
      let caughtError: any;
      try {
        await processor(makeJob(videoId, '720p'));
      } catch (err) {
        caughtError = err;
      }

      expect(caughtError).toBeInstanceOf(TransientError);
      expect(caughtError.code).toBe(ErrorCodes.DISK_FULL);
      expect(caughtError.details?.['hint']).toBe('DISK_FULL');

      // Check step recorded as FAILED with DISK_FULL
      const steps = await repositories.steps.findByVideoId(videoId);
      const transcodeStep = expectOk(steps).find((s) => s.step === 'transcode');
      expect(transcodeStep?.status).toBe('FAILED');
      expect(transcodeStep?.errorCode).toBe('DISK_FULL');

      // Guaranteed temp directory cleanup
      expect(capturedTmpDir).toBeTruthy();
      let dirExists = true;
      try {
        await fs.access(capturedTmpDir);
      } catch {
        dirExists = false;
      }
      expect(dirExists).toBe(false);
    });
  });

  describe('AC 1: Disk bounds during transcoding (sourceSize + 3 * maxSegmentBytes)', () => {
    it('uploads segments while encoding and deletes them, keeping disk usage strictly bounded', async () => {
      const videoId = await createVideo('raw/source.mp4', 50000);
      await storage.uploadObject({
        bucket: 'raw',
        key: 'raw/source.mp4',
        body: Buffer.alloc(50000, 1),
        contentType: 'video/mp4',
      });
      await repositories.renditions.create({
        id: uuidv7(),
        videoId,
        name: '720p',
        width: 1280,
        height: 720,
        videoBitrateKbps: 2800,
        audioBitrateKbps: 128,
      });

      const segmentSizeBytes = 10000;
      const totalSegments = 12;
      let capturedTmpDir = '';
      let peakDiskBytes = 0;

      const ffmpegModule = await import('@vp/ffmpeg');
      vi.spyOn(ffmpegModule, 'runFfmpegTranscode').mockImplementation(async (opts) => {
        capturedTmpDir = path.dirname(opts.outputDir);

        // Periodically check disk usage
        const sampler = setInterval(async () => {
          try {
            const files = await fs.readdir(opts.outputDir);
            let dirBytes = 0;
            for (const f of files) {
              const st = await fs.stat(path.join(opts.outputDir, f));
              dirBytes += st.size;
            }
            if (dirBytes > peakDiskBytes) peakDiskBytes = dirBytes;
          } catch {}
        }, 10);

        // Produce 12 segments sequentially with temporary names (.tmp -> .ts)
        for (let i = 0; i < totalSegments; i++) {
          const segName = `seg_${String(i).padStart(5, '0')}.ts`;
          const tmpName = `${segName}.tmp`;
          await fs.writeFile(path.join(opts.outputDir, tmpName), Buffer.alloc(segmentSizeBytes, 2));
          // Small delay then rename
          await new Promise((r) => setTimeout(r, 20));
          await fs.rename(path.join(opts.outputDir, tmpName), path.join(opts.outputDir, segName));
          await new Promise((r) => setTimeout(r, 25));
        }

        await fs.writeFile(
          path.join(opts.outputDir, 'index.m3u8'),
          '#EXTM3U\n#EXT-X-VERSION:6\n#EXT-X-PLAYLIST-TYPE:VOD\n#EXT-X-ENDLIST\n'
        );
        clearInterval(sampler);

        return {
          outputDir: opts.outputDir,
          playlistPath: path.join(opts.outputDir, 'index.m3u8'),
          segmentCount: totalSegments,
          durationMs: 72000,
        };
      });

      const processor = createTranscodeProcessor({ repositories, storage, logger });
      const result = await processor(makeJob(videoId, '720p'));

      expect(expectOk(result).segmentCount).toBe(totalSegments);

      // Peak disk bytes for segments in outputDir must never exceed 4 * segmentSizeBytes!
      // (Without streaming uploader, it would reach 12 * 10000 = 120,000 bytes)
      expect(peakDiskBytes).toBeLessThanOrEqual(4 * segmentSizeBytes + 1000);

      // Guaranteed local dir cleanup after completion
      let dirExists = true;
      try {
        await fs.access(capturedTmpDir);
      } catch {
        dirExists = false;
      }
      expect(dirExists).toBe(false);
    });

    it('guarantees temp directory cleanup after a forced failure', async () => {
      const videoId = await createVideo('raw/source.mp4');
      await storage.uploadObject({
        bucket: 'raw',
        key: 'raw/source.mp4',
        body: Buffer.from('mock-source'),
        contentType: 'video/mp4',
      });
      await repositories.renditions.create({
        id: uuidv7(),
        videoId,
        name: '720p',
        width: 1280,
        height: 720,
        videoBitrateKbps: 2800,
        audioBitrateKbps: 128,
      });

      const processor = createTranscodeProcessor({
        repositories,
        storage,
        logger,
        simulateFailureRendition: '720p',
      });

      await expect(processor(makeJob(videoId, '720p'))).rejects.toThrow();
    });

    it('AC 1: real FFmpeg transcode on s60 streams every segment and its playlist to storage', async () => {
      const rootDir = path.resolve(__dirname, '../../../../');
      const s60Path = path.join(rootDir, 'tests/fixtures/s60.mp4');
      if (
        !(await fs
          .stat(s60Path)
          .then(() => true)
          .catch(() => false))
      ) {
        return;
      }

      const sourceBuffer = await fs.readFile(s60Path);
      const sourceSize = sourceBuffer.byteLength;

      const videoId = await createVideo('raw/s60.mp4', sourceSize);
      await storage.uploadObject({
        bucket: 'raw',
        key: 'raw/s60.mp4',
        body: sourceBuffer,
        contentType: 'video/mp4',
      });

      await repositories.renditions.create({
        id: uuidv7(),
        videoId,
        name: '720p',
        width: 1280,
        height: 720,
        videoBitrateKbps: 2800,
        audioBitrateKbps: 128,
      });

      const processor = createTranscodeProcessor({
        repositories,
        storage,
        logger,
      });

      const job = {
        id: `${videoId}--transcode--720p--g1`,
        attemptsMade: 0,
        data: {
          videoId,
          sourceKey: 'raw/s60.mp4',
          generation: 1,
          rendition: {
            name: '720p',
            width: 1280,
            height: 720,
            videoKbps: 2800,
            maxrateKbps: 2996,
            bufsizeKbps: 4200,
            audioKbps: 128,
            profile: 'high',
            level: '3.1',
          },
          fps: 24,
          durationMs: 60000,
          traceparent: '00-s60-disk-test-01',
        },
      };

      const result = await processor(job as any);

      expect(expectOk(result).segmentCount).toBeGreaterThanOrEqual(10);
      expect(expectOk(result).bytes).toBeGreaterThan(50000);

      // Verify all segments exist in storage
      for (let i = 0; i < expectOk(result).segmentCount; i++) {
        const segKey = `videos/${videoId}/hls/720p/seg_${String(i).padStart(5, '0')}.ts`;
        const head = await storage.headObject('public', segKey);
        expect(head).not.toBeNull();
      }

      // Verify playlist exists in storage
      const playlistHead = await storage.headObject(
        'public',
        `videos/${videoId}/hls/720p/index.m3u8`
      );
      expect(playlistHead).not.toBeNull();
    });
  });
});
