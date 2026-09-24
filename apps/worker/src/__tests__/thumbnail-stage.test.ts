import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {
  InMemoryFlowProducer,
  InMemoryJobQueue,
  InMemoryRepositories,
  InMemoryStorageClient,
} from '@vp/adapters/in-memory';
import type { QueueJob } from '@vp/core/ports';
import { parseSpriteVtt } from '@vp/ffmpeg';
import type { ProbeJob, ThumbnailJob } from '@vp/job-contracts';
import { createLogger } from '@vp/logger';
import { expectErr, expectOk } from '@vp/testing/result';
import { uuidv7 } from 'uuidv7';
import { createPackageProcessor } from '../stages/package';
import { createProbeProcessor } from '../stages/probe';
import { createThumbnailProcessor } from '../stages/thumbnail';
import { createTranscodeProcessor } from '../stages/transcode';
import { throughRunner } from './queue-boundary';
import { STAGE_SETTINGS, failingThumbnails, transcodeDeps } from './stage-settings';

describe('Thumbnail Stage as Non-Blocking Flow Child (Ticket 13: AC 1, 2, 3)', () => {
  let repositories: InMemoryRepositories;
  let storage: InMemoryStorageClient;
  let queues: Map<string, InMemoryJobQueue>;
  let flowProducer: InMemoryFlowProducer;
  const logger = createLogger({ format: 'json', service: 'thumbnail-test', level: 'silent' });

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
      durationMs: 15_000,
      width: 1920,
      height: 1080,
    });
    return videoId;
  }

  it('AC 1: generates poster, a 3-frame sprite and a VTT with 3 cues for s15; uploads with immutable headers', async () => {
    const fixturePath = path.resolve(__dirname, '../../../../tests/fixtures/s15.mp4');
    const fixtureBytes = await fs.readFile(fixturePath);
    const sourceKey = 'raw/s15.mp4';
    const videoId = await setupUploadedVideo(sourceKey);

    await storage.uploadObject({
      bucket: 'raw',
      key: sourceKey,
      body: fixtureBytes,
      contentType: 'video/mp4',
    });

    const processor = createThumbnailProcessor({
      ...STAGE_SETTINGS,
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
        durationMs: 15_000,
        traceparent: '00-01-01-01',
      },
      attemptsMade: 0,
    };

    const result = expectOk(await processor(job));

    expect(result.posterKey).toBe(`videos/${videoId}/thumbs/poster.jpg`);
    expect(result.spriteKey).toBe(`videos/${videoId}/thumbs/sprite.jpg`);
    expect(result.spriteVttKey).toBe(`videos/${videoId}/thumbs/sprite.vtt`);

    // Verify storage uploads
    const posterHead = expectOk(await storage.headObject('public', result.posterKey));
    expect(posterHead).toBeTruthy();
    expect(posterHead?.contentType).toBe('image/jpeg');
    expect(posterHead?.cacheControl).toBe('public, max-age=31536000, immutable');

    const spriteHead = expectOk(await storage.headObject('public', result.spriteKey));
    expect(spriteHead).toBeTruthy();
    expect(spriteHead?.contentType).toBe('image/jpeg');
    expect(spriteHead?.cacheControl).toBe('public, max-age=31536000, immutable');

    const vttHead = expectOk(await storage.headObject('public', result.spriteVttKey));
    expect(vttHead).toBeTruthy();
    expect(vttHead?.contentType).toBe('text/vtt');
    expect(vttHead?.cacheControl).toBe('public, max-age=31536000, immutable');

    // Verify VTT contents
    const vttObj = expectOk(await storage.getObject('public', result.spriteVttKey));
    const vttText = typeof vttObj === 'string' ? vttObj : new TextDecoder('utf-8').decode(vttObj);
    const cues = parseSpriteVtt(vttText);
    expect(cues).toHaveLength(3);

    // Verify video record has posterKey and spriteKey
    const video = expectOk(await repositories.videos.findById(videoId));
    expect(video?.posterKey).toBe(result.posterKey);
    expect(video?.spriteKey).toBe(result.spriteKey);

    // Verify processing_steps
    const steps = expectOk(await repositories.steps.findByVideoId(videoId));
    const thumbStep = steps.find((s) => s.step === 'thumbnail');
    expect(thumbStep?.status).toBe('DONE');
    expect(thumbStep?.lockToken).toBeDefined();
    expect(thumbStep?.finishedAt).toBeDefined();
  });

  it('AC 2: Thumbnail child runs concurrently with transcodes in BullMQ Flow', async () => {
    const fixturePath = path.resolve(__dirname, '../../../../tests/fixtures/s15.mp4');
    const fixtureBytes = await fs.readFile(fixturePath);
    const sourceKey = 'raw/s15.mp4';
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
      ...STAGE_SETTINGS,
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
    const packageProcessor = createPackageProcessor({
      ...STAGE_SETTINGS,
      repositories,
      storage,
      logger,
      getQueue,
    });
    await qPackage.process(throughRunner(packageProcessor));

    const transcode1080 = createTranscodeProcessor(
      transcodeDeps({ repositories, storage, logger })
    );
    const transcode720 = createTranscodeProcessor(transcodeDeps({ repositories, storage, logger }));
    const transcode480 = createTranscodeProcessor(transcodeDeps({ repositories, storage, logger }));
    const thumbProcessor = createThumbnailProcessor({
      ...STAGE_SETTINGS,
      repositories,
      storage,
      logger,
    });

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
          durationMs: 15_000,
        };
      });

    // Execute children concurrently
    await Promise.all([
      q1080.process(throughRunner(transcode1080)),
      q720.process(throughRunner(transcode720)),
      q480.process(throughRunner(transcode480)),
      qThumb.process(thumbProcessor),
    ]);

    // Microtask drain for package completion
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Verify video is READY
    const video = expectOk(await repositories.videos.findById(videoId));
    expect(video?.status).toBe('READY');
    expect(video?.posterKey).toBe(`videos/${videoId}/thumbs/poster.jpg`);
    expect(video?.spriteKey).toBe(`videos/${videoId}/thumbs/sprite.jpg`);

    // Verify AC 2: start times overlap in processing_steps
    const steps = expectOk(await repositories.steps.findByVideoId(videoId));
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

  it('AC 3: A thumbnail FFmpeg failure -> package still runs, video READY, posterKey null, step FAILED with code, renditions unaffected', async () => {
    const fixturePath = path.resolve(__dirname, '../../../../tests/fixtures/s15.mp4');
    const fixtureBytes = await fs.readFile(fixturePath);
    const sourceKey = 'raw/s15.mp4';
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
          durationMs: 15_000,
        };
      });

    const probeProcessor = createProbeProcessor({
      ...STAGE_SETTINGS,
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
      } satisfies ProbeJob,
      attemptsMade: 0,
    });

    // 2. Setup workers
    const q1080 = getQueue('transcode-1080p');
    const q720 = getQueue('transcode-720p');
    const q480 = getQueue('transcode-480p');
    const qThumb = getQueue('thumbnail');
    const qPackage = getQueue('package');

    const packageProcessor = createPackageProcessor({
      ...STAGE_SETTINGS,
      repositories,
      storage,
      logger,
      getQueue,
    });
    await qPackage.process(throughRunner(packageProcessor));

    const transcode1080 = createTranscodeProcessor(
      transcodeDeps({ repositories, storage, logger })
    );
    const transcode720 = createTranscodeProcessor(transcodeDeps({ repositories, storage, logger }));
    const transcode480 = createTranscodeProcessor(transcodeDeps({ repositories, storage, logger }));
    const thumbProcessor = createThumbnailProcessor({
      ...STAGE_SETTINGS,
      repositories,
      storage,
      logger,
      media: failingThumbnails,
    });

    await Promise.all([
      q1080.process(throughRunner(transcode1080)),
      q720.process(throughRunner(transcode720)),
      q480.process(throughRunner(transcode480)),
      qThumb.process(thumbProcessor).catch(() => {}),
    ]);

    // Microtask drain for package completion
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Verify AC 3:
    // - package still runs and video becomes READY
    const video = expectOk(await repositories.videos.findById(videoId));
    expect(video?.status).toBe('READY');

    // - poster_key and sprite_key are null
    expect(video?.posterKey).toBeNull();
    expect(video?.spriteKey).toBeNull();

    // - thumbnail step in processing_steps is FAILED with error code
    const steps = expectOk(await repositories.steps.findByVideoId(videoId));
    const thumbStep = steps.find((s) => s.step === 'thumbnail');
    expect(thumbStep?.status).toBe('FAILED');
    expect(thumbStep?.errorCode).toBe('FFMPEG_FAILED');

    // - renditions are completely unaffected (all DONE)
    const renditions = expectOk(await repositories.renditions.findByVideoId(videoId));
    expect(renditions).toHaveLength(3);
    for (const r of renditions) {
      expect(r.status).toBe('DONE');
    }

    transcodeSpy.mockRestore();
  });

  it('fails thumbnail step with SOURCE_MISSING when source object is not found in storage', async () => {
    const videoId = await setupUploadedVideo('raw/missing.mp4');

    const processor = createThumbnailProcessor({
      ...STAGE_SETTINGS,
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
        durationMs: 15_000,
        traceparent: '00-01',
      },
      attemptsMade: 0,
    };

    expect(expectErr(await processor(job)).message).toMatch(/Source object not found/);

    const steps = expectOk(await repositories.steps.findByVideoId(videoId));
    const thumbStep = steps.find((s) => s.step === 'thumbnail');
    expect(thumbStep?.status).toBe('FAILED');
    expect(thumbStep?.errorCode).toBe('SOURCE_MISSING');
  });
});
