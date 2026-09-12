import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {
  InMemoryFlowProducer,
  InMemoryJobQueue,
  InMemoryRepositories,
  InMemoryStorageClient,
} from '@vp/adapters';
import type { QueueJob } from '@vp/core/ports';
import { parseSpriteVtt } from '@vp/ffmpeg';
import type { ProbeJob, ThumbnailJob } from '@vp/job-contracts';
import { createLogger } from '@vp/observability';
import { uuidv7 } from 'uuidv7';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPackageProcessor } from '../stages/package';
import { createProbeProcessor } from '../stages/probe';
import { createThumbnailProcessor } from '../stages/thumbnail';
import { createTranscodeProcessor } from '../stages/transcode';

describe('Thumbnail Stage as Non-Blocking Flow Child (Ticket 13: AC 1, 2, 3)', () => {
  let repositories: InMemoryRepositories;
  let storage: InMemoryStorageClient;
  let queues: Map<string, InMemoryJobQueue>;
  let flowProducer: InMemoryFlowProducer;
  const logger = createLogger({ service: 'thumbnail-test', level: 'silent' });

  function getQueue(name: string): InMemoryJobQueue {
    let q = queues.get(name);
    if (!q) {
      q = new InMemoryJobQueue(name);
      queues.set(name, q);
    }
    return q;
  }

  beforeEach(() => {
    repositories = new InMemoryRepositories();
    storage = new InMemoryStorageClient();
    queues = new Map();
    flowProducer = new InMemoryFlowProducer(getQueue);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function setupUploadedVideo(sourceKey: string, title = 'Thumbnail Video'): Promise<string> {
    const videoId = uuidv7();
    await repositories.videos.create({
      id: videoId,
      ownerId: '00000000-0000-7000-8000-000000000001',
      title,
      status: 'PROCESSING',
      sourceKey,
      durationMs: 60_000,
      width: 1920,
      height: 1080,
    });
    return videoId;
  }

  it('AC 1: generates poster, 12-frame sprite, and VTT with 12 cues for s60; uploads with immutable headers', async () => {
    const fixturePath = path.resolve(__dirname, '../../../../tests/fixtures/s60.mp4');
    const fixtureBytes = await fs.readFile(fixturePath);
    const sourceKey = 'raw/s60.mp4';
    const videoId = await setupUploadedVideo(sourceKey);

    await storage.uploadObject({
      bucket: 'raw',
      key: sourceKey,
      body: fixtureBytes,
      contentType: 'video/mp4',
    });

    const processor = createThumbnailProcessor({
      repositories,
      storage,
      logger,
    });

    const job: QueueJob<ThumbnailJob> = {
      id: `${videoId}--thumbnail--g1`,
      name: 'thumbnail',
      data: {
        videoId,
        sourceKey,
        generation: 1,
        durationMs: 60_000,
        traceparent: '00-01-01-01',
      },
      attemptsMade: 0,
    };

    const result = await processor(job);

    expect(result.posterKey).toBe(`videos/${videoId}/thumbs/poster.jpg`);
    expect(result.spriteKey).toBe(`videos/${videoId}/thumbs/sprite.jpg`);
    expect(result.spriteVttKey).toBe(`videos/${videoId}/thumbs/sprite.vtt`);

    // Verify storage uploads
    const posterHead = await storage.headObject('public', result.posterKey);
    expect(posterHead).toBeTruthy();
    expect(posterHead?.contentType).toBe('image/jpeg');
    expect(posterHead?.cacheControl).toBe('public, max-age=31536000, immutable');

    const spriteHead = await storage.headObject('public', result.spriteKey);
    expect(spriteHead).toBeTruthy();
    expect(spriteHead?.contentType).toBe('image/jpeg');
    expect(spriteHead?.cacheControl).toBe('public, max-age=31536000, immutable');

    const vttHead = await storage.headObject('public', result.spriteVttKey);
    expect(vttHead).toBeTruthy();
    expect(vttHead?.contentType).toBe('text/vtt');
    expect(vttHead?.cacheControl).toBe('public, max-age=31536000, immutable');

    // Verify VTT contents
    const vttObj = await storage.getObject('public', result.spriteVttKey);
    const vttText = typeof vttObj === 'string' ? vttObj : new TextDecoder('utf-8').decode(vttObj);
    const cues = parseSpriteVtt(vttText);
    expect(cues.length).toBeGreaterThanOrEqual(11);
    expect(cues.length).toBeLessThanOrEqual(13);

    // Verify video record has posterKey and spriteKey
    const video = await repositories.videos.findById(videoId);
    expect(video?.posterKey).toBe(result.posterKey);
    expect(video?.spriteKey).toBe(result.spriteKey);

    // Verify processing_steps
    const steps = await repositories.steps.findByVideoId(videoId);
    const thumbStep = steps.find((s) => s.step === 'thumbnail');
    expect(thumbStep?.status).toBe('DONE');
    expect(thumbStep?.lockToken).toBeDefined();
    expect(thumbStep?.finishedAt).toBeDefined();
  });

  it('AC 2: Thumbnail child runs concurrently with transcodes in BullMQ Flow', async () => {
    const fixturePath = path.resolve(__dirname, '../../../../tests/fixtures/s60.mp4');
    const fixtureBytes = await fs.readFile(fixturePath);
    const sourceKey = 'raw/s60.mp4';
    const videoId = uuidv7();

    await repositories.videos.create({
      id: videoId,
      ownerId: '00000000-0000-7000-8000-000000000001',
      title: 'Concurrent Flow Video',
      status: 'UPLOADED',
      sourceKey,
    });

    await storage.uploadObject({
      bucket: 'raw',
      key: sourceKey,
      body: fixtureBytes,
      contentType: 'video/mp4',
    });

    // 1. Run probe stage to construct flow
    const probeProcessor = createProbeProcessor({
      repositories,
      storage,
      logger,
      getQueue,
      flowProducer,
    });

    await probeProcessor({
      id: `${videoId}--probe--g1`,
      name: 'probe',
      data: { videoId, sourceKey, generation: 1, traceparent: '00-01' },
      attemptsMade: 0,
    });

    // 2. Setup workers for all children
    const q1080 = getQueue('transcode-1080p');
    const q720 = getQueue('transcode-720p');
    const q480 = getQueue('transcode-480p');
    const qThumb = getQueue('thumbnail');
    const qPackage = getQueue('package');

    // Register package processor
    const packageProcessor = createPackageProcessor({ repositories, storage, logger, getQueue });
    await qPackage.process(packageProcessor);

    const transcode1080 = createTranscodeProcessor({ repositories, storage, logger, getQueue });
    const transcode720 = createTranscodeProcessor({ repositories, storage, logger, getQueue });
    const transcode480 = createTranscodeProcessor({ repositories, storage, logger, getQueue });
    const thumbProcessor = createThumbnailProcessor({ repositories, storage, logger });

    const ffmpegModule = await import('@vp/ffmpeg');
    const transcodeSpy = vi
      .spyOn(ffmpegModule, 'runFfmpegTranscode')
      .mockImplementation(async (options) => {
        await new Promise((resolve) => setTimeout(resolve, 30));
        await fs.writeFile(
          path.join(options.outputDir, 'index.m3u8'),
          '#EXTM3U\n#EXT-X-VERSION:6\n'
        );
        for (let i = 0; i < 5; i++) {
          await fs.writeFile(
            path.join(options.outputDir, `seg_${String(i).padStart(5, '0')}.ts`),
            Buffer.alloc(100)
          );
        }
        return {
          outputDir: options.outputDir,
          playlistPath: path.join(options.outputDir, 'index.m3u8'),
          segmentCount: 5,
          durationMs: 60_000,
        };
      });

    // Execute children concurrently
    await Promise.all([
      q1080.process(transcode1080),
      q720.process(transcode720),
      q480.process(transcode480),
      qThumb.process(thumbProcessor),
    ]);

    // Microtask drain for package completion
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Verify video is READY
    const video = await repositories.videos.findById(videoId);
    expect(video?.status).toBe('READY');
    expect(video?.posterKey).toBe(`videos/${videoId}/thumbs/poster.jpg`);
    expect(video?.spriteKey).toBe(`videos/${videoId}/thumbs/sprite.jpg`);

    // Verify AC 2: start times overlap in processing_steps
    const steps = await repositories.steps.findByVideoId(videoId);
    const thumbStep = steps.find((s) => s.step === 'thumbnail');
    const transcodeSteps = steps.filter(
      (s) => s.step.startsWith('transcode') || s.step === 'transcode'
    );

    expect(thumbStep).toBeDefined();
    const thumbStart = thumbStep?.startedAt?.getTime() ?? 0;
    const thumbEnd = thumbStep?.finishedAt?.getTime() ?? 0;

    // At least one transcode step starts before thumbnail finishes, and thumbnail starts before transcode finishes
    const hasOverlap = transcodeSteps.some((ts) => {
      const tcStart = ts.startedAt?.getTime() ?? 0;
      const tcEnd = ts.finishedAt?.getTime() ?? 0;
      return thumbStart <= tcEnd && tcStart <= thumbEnd;
    });

    expect(hasOverlap).toBe(true);
    transcodeSpy.mockRestore();
  });

  it('AC 3: Forced thumbnail failure -> package still runs, video READY, posterKey null, step FAILED with code, renditions unaffected', async () => {
    const fixturePath = path.resolve(__dirname, '../../../../tests/fixtures/s60.mp4');
    const fixtureBytes = await fs.readFile(fixturePath);
    const sourceKey = 'raw/s60.mp4';
    const videoId = uuidv7();

    await repositories.videos.create({
      id: videoId,
      ownerId: '00000000-0000-7000-8000-000000000001',
      title: 'Failing Thumbnail Video',
      status: 'UPLOADED',
      sourceKey,
    });

    await storage.uploadObject({
      bucket: 'raw',
      key: sourceKey,
      body: fixtureBytes,
      contentType: 'video/mp4',
    });

    const ffmpegModule = await import('@vp/ffmpeg');
    const transcodeSpy = vi
      .spyOn(ffmpegModule, 'runFfmpegTranscode')
      .mockImplementation(async (options) => {
        await fs.writeFile(
          path.join(options.outputDir, 'index.m3u8'),
          '#EXTM3U\n#EXT-X-VERSION:6\n'
        );
        for (let i = 0; i < 5; i++) {
          await fs.writeFile(
            path.join(options.outputDir, `seg_${String(i).padStart(5, '0')}.ts`),
            Buffer.alloc(100)
          );
        }
        return {
          outputDir: options.outputDir,
          playlistPath: path.join(options.outputDir, 'index.m3u8'),
          segmentCount: 5,
          durationMs: 60_000,
        };
      });

    // 1. Run probe with forceThumbnailFailure flag
    const probeProcessor = createProbeProcessor({
      repositories,
      storage,
      logger,
      getQueue,
      flowProducer,
    });

    await probeProcessor({
      id: `${videoId}--probe--g1`,
      name: 'probe',
      data: {
        videoId,
        sourceKey,
        generation: 1,
        traceparent: '00-01',
        forceThumbnailFailure: true,
      } satisfies ProbeJob,
      attemptsMade: 0,
    });

    // 2. Setup workers
    const q1080 = getQueue('transcode-1080p');
    const q720 = getQueue('transcode-720p');
    const q480 = getQueue('transcode-480p');
    const qThumb = getQueue('thumbnail');
    const qPackage = getQueue('package');

    const packageProcessor = createPackageProcessor({ repositories, storage, logger, getQueue });
    await qPackage.process(packageProcessor);

    const transcode1080 = createTranscodeProcessor({ repositories, storage, logger, getQueue });
    const transcode720 = createTranscodeProcessor({ repositories, storage, logger, getQueue });
    const transcode480 = createTranscodeProcessor({ repositories, storage, logger, getQueue });
    const thumbProcessor = createThumbnailProcessor({ repositories, storage, logger });

    // Process all children (thumbnail fails due to forceFailure: true)
    await Promise.all([
      q1080.process(transcode1080),
      q720.process(transcode720),
      q480.process(transcode480),
      qThumb.process(thumbProcessor).catch(() => {}),
    ]);

    // Microtask drain for package completion
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Verify AC 3:
    // - package still runs and video becomes READY
    const video = await repositories.videos.findById(videoId);
    expect(video?.status).toBe('READY');

    // - poster_key and sprite_key are null
    expect(video?.posterKey).toBeNull();
    expect(video?.spriteKey).toBeNull();

    // - thumbnail step in processing_steps is FAILED with error code
    const steps = await repositories.steps.findByVideoId(videoId);
    const thumbStep = steps.find((s) => s.step === 'thumbnail');
    expect(thumbStep?.status).toBe('FAILED');
    expect(thumbStep?.errorCode).toBe('FFMPEG_FAILED');

    // - renditions are completely unaffected (all DONE)
    const renditions = await repositories.renditions.findByVideoId(videoId);
    expect(renditions).toHaveLength(3);
    for (const r of renditions) {
      expect(r.status).toBe('DONE');
    }

    transcodeSpy.mockRestore();
  });

  it('fails thumbnail step with SOURCE_MISSING when source object is not found in storage', async () => {
    const videoId = await setupUploadedVideo('raw/missing.mp4');

    const processor = createThumbnailProcessor({
      repositories,
      storage,
      logger,
    });

    const job: QueueJob<ThumbnailJob> = {
      id: `${videoId}--thumbnail--g1`,
      name: 'thumbnail',
      data: {
        videoId,
        sourceKey: 'raw/missing.mp4',
        generation: 1,
        durationMs: 60_000,
        traceparent: '00-01',
      },
      attemptsMade: 0,
    };

    await expect(processor(job)).rejects.toThrow(/Source object not found/);

    const steps = await repositories.steps.findByVideoId(videoId);
    const thumbStep = steps.find((s) => s.step === 'thumbnail');
    expect(thumbStep?.status).toBe('FAILED');
    expect(thumbStep?.errorCode).toBe('SOURCE_MISSING');
  });
});
