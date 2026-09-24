import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {
  InMemoryFlowProducer,
  InMemoryJobQueue,
  InMemoryRepositories,
  InMemoryStorageClient,
} from '@vp/adapters/in-memory';
import type { QueueJob } from '@vp/core/ports';
import type { ProbeJob } from '@vp/job-contracts';
import { createLogger } from '@vp/logger';
import { expectOk } from '@vp/testing/result';
import { uuidv7 } from 'uuidv7';
import { createPackageProcessor } from '../stages/package';
import { createProbeProcessor } from '../stages/probe';
import { createThumbnailProcessor } from '../stages/thumbnail';
import { createTranscodeProcessor } from '../stages/transcode';
import { throughRunner } from './queue-boundary';
import { STAGE_SETTINGS, failingTranscodeOf, transcodeDeps } from './stage-settings';

describe('Fan-out / fan-in with BullMQ Flows (Ticket 12: AC 1, 2, 3, 4, 5, 6)', () => {
  let repositories: InMemoryRepositories;
  let storage: InMemoryStorageClient;
  let queues: Map<string, InMemoryJobQueue>;
  let flowProducer: InMemoryFlowProducer;
  const DEV_USER_ID = '00000000-0000-7000-8000-000000000001';
  const logger = createLogger({ format: 'json', service: 'fanout-fanin-test', level: 'silent' });

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

  async function setupUploadedVideo(sourceKey: string, title = 'Test Flow Video'): Promise<string> {
    const videoId = uuidv7();
    await repositories.videos.create({
      id: videoId,
      ownerId: DEV_USER_ID,
      title,
      status: 'UPLOADED',
      sourceKey,
      sourceSizeBytes: 10_000_000,
    });
    return videoId;
  }

  it('AC 1, AC 3, AC 6: s60 1080p creates flow with package parent and 3 transcode children; package stays in waiting-children until last child completes; master has 3 EXT-X-STREAM-INF entries with measured AVERAGE-BANDWIDTH and correct CODECS', async () => {
    const sourceKey = 'raw/s60.mp4';
    const videoId = await setupUploadedVideo(sourceKey, '1080p Video');

    await storage.uploadObject({
      bucket: 'raw',
      key: sourceKey,
      body: Buffer.from('mock-1080p-source-bytes'),
      contentType: 'video/mp4',
    });

    const ffmpegModule = await import('@vp/ffmpeg');
    const probeSpy = vi.spyOn(ffmpegModule, 'runFfprobe').mockResolvedValue({
      durationMs: 60_000,
      width: 1920,
      height: 1080,
      effectiveWidth: 1920,
      effectiveHeight: 1080,
      rotation: 0,
      fps: 24,
      videoCodec: 'h264',
      audioCodec: 'aac',
      bitrateKbps: 5000,
      ladder: [
        {
          name: '1080p',
          width: 1920,
          height: 1080,
          videoKbps: 5000,
          maxrateKbps: 5350,
          bufsizeKbps: 7500,
          audioKbps: 128,
          profile: 'high',
          level: '4.1',
        },
        {
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
        {
          name: '480p',
          width: 854,
          height: 480,
          videoKbps: 1400,
          maxrateKbps: 1498,
          bufsizeKbps: 2100,
          audioKbps: 96,
          profile: 'main',
          level: '3.1',
        },
      ],
    });

    // Mock transcode to generate segment and index files in outputDir
    const transcodeSpy = vi
      .spyOn(ffmpegModule, 'runFfmpegTranscode')
      .mockImplementation(async (options) => {
        for (let i = 1; i <= 10; i++) {
          await fs.writeFile(
            path.join(options.outputDir, `seg_${String(i).padStart(5, '0')}.ts`),
            Buffer.alloc(options.rendition.name === '1080p' ? 2000 : 1000)
          );
        }
        await fs.writeFile(
          path.join(options.outputDir, 'index.m3u8'),
          '#EXTM3U\n#EXT-X-VERSION:6\n#EXT-X-TARGETDURATION:6\n'
        );
        return {
          outputDir: options.outputDir,
          playlistPath: path.join(options.outputDir, 'index.m3u8'),
          segmentCount: 10,
          durationMs: 60_000,
        };
      });

    const thumbSpy = vi
      .spyOn(ffmpegModule, 'runFfmpegThumbnail')
      .mockImplementation(async (options) => {
        await fs.writeFile(path.join(options.outputDir, 'poster.jpg'), Buffer.alloc(100));
        await fs.writeFile(path.join(options.outputDir, 'sprite.jpg'), Buffer.alloc(100));
        await fs.writeFile(path.join(options.outputDir, 'sprite.vtt'), 'WEBVTT\n');
        return {
          outputDir: options.outputDir,
          posterPath: path.join(options.outputDir, 'poster.jpg'),
          spritePath: path.join(options.outputDir, 'sprite.jpg'),
          vttPath: path.join(options.outputDir, 'sprite.vtt'),
          frameCount: 12,
          rows: 2,
          columns: 10,
        };
      });

    // 1. Run probe processor
    const probeProcessor = createProbeProcessor({
      ...STAGE_SETTINGS,
      repositories,
      storage,
      logger,
      getQueue,
      flowProducer,
    });

    const probeJob: QueueJob<ProbeJob> = {
      id: `${videoId}--probe--g1`,
      name: 'probe',
      data: {
        videoId,
        sourceKey,
        generation: 1,
        traceparent: '00-01-01-01',
      },
      attemptsMade: 0,
    };

    const probeResult = expectOk(await probeProcessor(probeJob));
    expect(probeResult.status).toBe('PROCESSING');

    // Verify AC 3: package is in waiting-children
    const packageQueue = getQueue('package');
    const packageJobId = `${videoId}--package--g1`;
    const packageState = expectOk(await packageQueue.getJobState(packageJobId));
    expect(packageState).toBe('waiting-children');

    // Register package processor
    const packageProcessor = createPackageProcessor({
      ...STAGE_SETTINGS,
      repositories,
      storage,
      logger,
      getQueue,
    });
    await packageQueue.process(throughRunner(packageProcessor));

    // Verify package has NOT executed yet (still in waiting-children)
    expect(expectOk(await packageQueue.getJobState(packageJobId))).toBe('waiting-children');
    const videoBeforeTranscode = expectOk(await repositories.videos.findById(videoId));
    expect(videoBeforeTranscode?.status).toBe('PROCESSING');

    // 2. Process transcode children on queues transcode-1080p, transcode-720p, transcode-480p and thumbnail
    const q1080 = getQueue('transcode-1080p');
    const q720 = getQueue('transcode-720p');
    const q480 = getQueue('transcode-480p');
    const qThumb = getQueue('thumbnail');

    const transcode1080 = createTranscodeProcessor(
      transcodeDeps({ repositories, storage, logger })
    );
    const transcode720 = createTranscodeProcessor(transcodeDeps({ repositories, storage, logger }));
    const transcode480 = createTranscodeProcessor(transcodeDeps({ repositories, storage, logger }));
    const thumbnailProcessor = createThumbnailProcessor({
      ...STAGE_SETTINGS,
      repositories,
      storage,
      logger,
    });

    // Process 1080p and 720p first; package should STILL be in waiting-children
    await q1080.process(throughRunner(transcode1080));
    await q720.process(throughRunner(transcode720));

    expect(expectOk(await packageQueue.getJobState(packageJobId))).toBe('waiting-children');

    // Process thumbnail; package should STILL be in waiting-children because 480p is pending
    await qThumb.process(throughRunner(thumbnailProcessor));
    expect(expectOk(await packageQueue.getJobState(packageJobId))).toBe('waiting-children');

    // Process 480p (the final child)
    await q480.process(throughRunner(transcode480));

    // Package now executes automatically upon completion of the last child!
    // Wait a tick for microtask drain
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Verify package completed
    expect(expectOk(await packageQueue.getJobState(packageJobId))).toBe('completed');

    // 3. Verify video is now READY (AC 1)
    const video = expectOk(await repositories.videos.findById(videoId));
    expect(video?.status).toBe('READY');
    expect(video?.masterPlaylistKey).toBe(`videos/${videoId}/hls/master.m3u8`);
    expect(video?.readyAt).toBeDefined();

    // 4. Verify storage contains the 3 rendition directories and master.m3u8 (AC 1)
    expect(
      await storage.headObject('public', `videos/${videoId}/hls/1080p/index.m3u8`)
    ).toBeTruthy();
    expect(
      await storage.headObject('public', `videos/${videoId}/hls/720p/index.m3u8`)
    ).toBeTruthy();
    expect(
      await storage.headObject('public', `videos/${videoId}/hls/480p/index.m3u8`)
    ).toBeTruthy();
    expect(await storage.headObject('public', `videos/${videoId}/hls/master.m3u8`)).toBeTruthy();

    // 5. Verify master playlist contents (AC 1, AC 6)
    const masterObj = expectOk(
      await storage.getObject('public', `videos/${videoId}/hls/master.m3u8`)
    );
    const masterText = masterObj.toString('utf-8');

    // Three EXT-X-STREAM-INF entries
    const streamInfLines = masterText
      .split('\n')
      .filter((l: string) => l.startsWith('#EXT-X-STREAM-INF:'));
    expect(streamInfLines.length).toBe(3);

    // Check correct CODECS (AC 6: avc1.640029, avc1.64001f, avc1.4d401f)
    expect(masterText).toContain('CODECS="avc1.640029,mp4a.40.2"');
    expect(masterText).toContain('CODECS="avc1.64001f,mp4a.40.2"');
    expect(masterText).toContain('CODECS="avc1.4d401f,mp4a.40.2"');

    // Check AVERAGE-BANDWIDTH measured from children
    expect(masterText).toMatch(/AVERAGE-BANDWIDTH=\d+/);

    // Check order: 1080p -> 720p -> 480p
    const lines = masterText.split('\n');
    const idx1080 = lines.findIndex((l: string) => l.includes('1080p/index.m3u8'));
    const idx720 = lines.findIndex((l: string) => l.includes('720p/index.m3u8'));
    const idx480 = lines.findIndex((l: string) => l.includes('480p/index.m3u8'));
    expect(idx1080).toBeLessThan(idx720);
    expect(idx720).toBeLessThan(idx480);

    probeSpy.mockRestore();
    transcodeSpy.mockRestore();
    thumbSpy.mockRestore();
  });

  it('AC 2: p720 yields 2 variants, sd360 yields 1 variant (480p rung), ladder stored on video, renditions progress PENDING -> RUNNING -> DONE independently', async () => {
    const p720Key = 'raw/p720.mp4';
    const p720Id = await setupUploadedVideo(p720Key, '720p Video');
    await storage.uploadObject({
      bucket: 'raw',
      key: p720Key,
      body: Buffer.from('p720'),
      contentType: 'video/mp4',
    });

    const sd360Key = 'raw/sd360.mp4';
    const sd360Id = await setupUploadedVideo(sd360Key, '360p Video');
    await storage.uploadObject({
      bucket: 'raw',
      key: sd360Key,
      body: Buffer.from('sd360'),
      contentType: 'video/mp4',
    });

    const ffmpegModule = await import('@vp/ffmpeg');

    // Mock p720 probe: 720p height -> 720p and 480p
    vi.spyOn(ffmpegModule, 'runFfprobe').mockResolvedValueOnce({
      durationMs: 30_000,
      width: 1280,
      height: 720,
      effectiveWidth: 1280,
      effectiveHeight: 720,
      rotation: 0,
      fps: 24,
      videoCodec: 'h264',
      bitrateKbps: 2800,
      ladder: [
        {
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
        {
          name: '480p',
          width: 854,
          height: 480,
          videoKbps: 1400,
          maxrateKbps: 1498,
          bufsizeKbps: 2100,
          audioKbps: 96,
          profile: 'main',
          level: '3.1',
        },
      ],
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
      id: `${p720Id}--probe--g1`,
      name: 'probe',
      data: { videoId: p720Id, sourceKey: p720Key, generation: 1, traceparent: '00-1' },
      attemptsMade: 0,
    });

    // 1. Verify p720 has ladder with 2 variants stored on video row (AC 2)
    const p720Video = expectOk(await repositories.videos.findById(p720Id));
    expect(p720Video?.ladder as any[]).toHaveLength(2);
    expect((p720Video?.ladder as any[])?.map((r: any) => r.name)).toEqual(['720p', '480p']);

    // 2. Verify p720 renditions start PENDING
    let p720Rends = expectOk(await repositories.renditions.findByVideoId(p720Id));
    expect(p720Rends.map((r: any) => r.status)).toEqual(['PENDING', 'PENDING']);

    // Mock sd360 probe: 360p height -> 480p (lowest rung kept, upscaled by rule)
    vi.spyOn(ffmpegModule, 'runFfprobe').mockResolvedValueOnce({
      durationMs: 15_000,
      width: 640,
      height: 360,
      effectiveWidth: 640,
      effectiveHeight: 360,
      rotation: 0,
      fps: 24,
      videoCodec: 'h264',
      bitrateKbps: 1400,
      ladder: [
        {
          name: '480p',
          width: 854,
          height: 480,
          videoKbps: 1400,
          maxrateKbps: 1498,
          bufsizeKbps: 2100,
          audioKbps: 96,
          profile: 'main',
          level: '3.1',
        },
      ],
    });

    await probeProcessor({
      id: `${sd360Id}--probe--g1`,
      name: 'probe',
      data: { videoId: sd360Id, sourceKey: sd360Key, generation: 1, traceparent: '00-1' },
      attemptsMade: 0,
    });

    // 3. Verify sd360 has ladder with 1 variant (480p) stored on video row (AC 2)
    const sd360Video = expectOk(await repositories.videos.findById(sd360Id));
    expect(sd360Video?.ladder as any[]).toHaveLength(1);
    expect((sd360Video?.ladder as any[])?.[0]?.name).toBe('480p');

    // 4. Verify independent rendition state progression PENDING -> RUNNING -> DONE
    vi.spyOn(ffmpegModule, 'runFfmpegTranscode').mockImplementation(async (options) => {
      // While running, verify rendition status is RUNNING
      const inFlightRends = expectOk(await repositories.renditions.findByVideoId(p720Id));
      const currentRend = inFlightRends.find((r: any) => r.name === options.rendition.name);
      expect(currentRend?.status).toBe('RUNNING');

      await fs.writeFile(path.join(options.outputDir, 'seg_00001.ts'), Buffer.alloc(100));
      await fs.writeFile(path.join(options.outputDir, 'index.m3u8'), '#EXTM3U\n');
      return {
        outputDir: options.outputDir,
        playlistPath: path.join(options.outputDir, 'index.m3u8'),
        segmentCount: 1,
        durationMs: 30_000,
      };
    });

    const transcode720 = createTranscodeProcessor(transcodeDeps({ repositories, storage, logger }));
    await getQueue('transcode-720p').process(throughRunner(transcode720));

    p720Rends = expectOk(await repositories.renditions.findByVideoId(p720Id));
    const r720 = p720Rends.find((r) => r.name === '720p');
    const r480 = p720Rends.find((r) => r.name === '480p');
    expect(r720?.status).toBe('DONE');
    expect(r480?.status).toBe('PENDING'); // 480p is still PENDING independently!
  });

  it('AC 4: Deterministic child job IDs {videoId}--transcode--{r}--g1; re-running probe adds no duplicate children', async () => {
    const sourceKey = 'raw/s60.mp4';
    const videoId = await setupUploadedVideo(sourceKey);
    await storage.uploadObject({
      bucket: 'raw',
      key: sourceKey,
      body: Buffer.from('s60'),
      contentType: 'video/mp4',
    });

    const ffmpegModule = await import('@vp/ffmpeg');
    vi.spyOn(ffmpegModule, 'runFfprobe').mockResolvedValue({
      durationMs: 60_000,
      width: 1920,
      height: 1080,
      effectiveWidth: 1920,
      effectiveHeight: 1080,
      rotation: 0,
      fps: 24,
      videoCodec: 'h264',
      bitrateKbps: 5000,
      ladder: [
        {
          name: '1080p',
          width: 1920,
          height: 1080,
          videoKbps: 5000,
          maxrateKbps: 5350,
          bufsizeKbps: 7500,
          audioKbps: 128,
          profile: 'high',
          level: '4.1',
        },
        {
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
        {
          name: '480p',
          width: 854,
          height: 480,
          videoKbps: 1400,
          maxrateKbps: 1498,
          bufsizeKbps: 2100,
          audioKbps: 96,
          profile: 'main',
          level: '3.1',
        },
      ],
    });

    const probeProcessor = createProbeProcessor({
      ...STAGE_SETTINGS,
      repositories,
      storage,
      logger,
      getQueue,
      flowProducer,
    });

    // Run probe first time
    await probeProcessor({
      id: `${videoId}--probe--g1`,
      name: 'probe',
      data: { videoId, sourceKey, generation: 1, traceparent: '00-1' },
      attemptsMade: 0,
    });

    const q1080 = getQueue('transcode-1080p');
    const q720 = getQueue('transcode-720p');
    const q480 = getQueue('transcode-480p');
    const qThumb = getQueue('thumbnail');

    expect(q1080.enqueuedJobs).toHaveLength(1);
    expect(q720.enqueuedJobs).toHaveLength(1);
    expect(q480.enqueuedJobs).toHaveLength(1);
    expect(qThumb.enqueuedJobs).toHaveLength(1);

    // Verify deterministic child job IDs (AC 4)
    expect(q1080.enqueuedJobs[0]?.id).toBe(`${videoId}--transcode--1080p--g1`);
    expect(q720.enqueuedJobs[0]?.id).toBe(`${videoId}--transcode--720p--g1`);
    expect(q480.enqueuedJobs[0]?.id).toBe(`${videoId}--transcode--480p--g1`);
    expect(qThumb.enqueuedJobs[0]?.id).toBe(`${videoId}--thumbnail--g1`);

    // Re-run probe (simulate re-enqueue of same probe job)
    await probeProcessor({
      id: `${videoId}--probe--g1`,
      name: 'probe',
      data: { videoId, sourceKey, generation: 1, traceparent: '00-1' },
      attemptsMade: 1,
    });

    // Verify AC 4: no duplicate children added to any transcode or thumbnail queue
    expect(q1080.enqueuedJobs).toHaveLength(1);
    expect(q720.enqueuedJobs).toHaveLength(1);
    expect(q480.enqueuedJobs).toHaveLength(1);
    expect(qThumb.enqueuedJobs).toHaveLength(1);
  });

  it('AC 5: A permanent FFmpeg failure in transcode-480p -> parent fails -> video FAILED with child error_code, other children outputs left in place', async () => {
    const sourceKey = 'raw/s60.mp4';
    const videoId = await setupUploadedVideo(sourceKey, 'Failing Video');
    await storage.uploadObject({
      bucket: 'raw',
      key: sourceKey,
      body: Buffer.from('s60'),
      contentType: 'video/mp4',
    });

    const ffmpegModule = await import('@vp/ffmpeg');
    vi.spyOn(ffmpegModule, 'runFfprobe').mockResolvedValue({
      durationMs: 60_000,
      width: 1920,
      height: 1080,
      effectiveWidth: 1920,
      effectiveHeight: 1080,
      rotation: 0,
      fps: 24,
      videoCodec: 'h264',
      bitrateKbps: 5000,
      ladder: [
        {
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
        {
          name: '480p',
          width: 854,
          height: 480,
          videoKbps: 1400,
          maxrateKbps: 1498,
          bufsizeKbps: 2100,
          audioKbps: 96,
          profile: 'main',
          level: '3.1',
        },
      ],
    });

    vi.spyOn(ffmpegModule, 'runFfmpegTranscode').mockImplementation(async (options) => {
      await fs.writeFile(path.join(options.outputDir, 'seg_00001.ts'), Buffer.alloc(100));
      await fs.writeFile(path.join(options.outputDir, 'index.m3u8'), '#EXTM3U\n');
      return {
        outputDir: options.outputDir,
        playlistPath: path.join(options.outputDir, 'index.m3u8'),
        segmentCount: 1,
        durationMs: 60_000,
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
      data: { videoId, sourceKey, generation: 1, traceparent: '00-1' },
      attemptsMade: 0,
    });

    // Wire package failure handler on package queue (matching runner.ts)
    const packageQueue = getQueue('package');
    packageQueue.onFailed(async (job, err) => {
      const vId = (job.data as any)?.videoId;
      const errorCode = (err as any)?.code || 'TRANSCODE_FAILED';
      await repositories.videos.transition({
        videoId: vId,
        from: 'PROCESSING',
        to: 'FAILED',
        eventType: 'video.failed',
        eventPayload: { errorCode, errorMessage: err.message },
        patch: { errorCode, errorMessage: err.message },
      });
    });

    // 1. Process 720p successfully
    const transcode720 = createTranscodeProcessor(transcodeDeps({ repositories, storage, logger }));
    await getQueue('transcode-720p').process(throughRunner(transcode720));

    // Verify 720p output was uploaded to storage
    expect(
      await storage.headObject('public', `videos/${videoId}/hls/720p/index.m3u8`)
    ).toBeTruthy();
    const rendsBeforeFail = expectOk(await repositories.renditions.findByVideoId(videoId));
    expect(rendsBeforeFail.find((r: any) => r.name === '720p')?.status).toBe('DONE');

    const transcode480 = createTranscodeProcessor(
      transcodeDeps({ repositories, storage, logger, media: failingTranscodeOf('480p') })
    );

    await expect(getQueue('transcode-480p').process(throughRunner(transcode480))).rejects.toThrow(
      'FFmpeg failed for transcode-480p'
    );

    // 3. Verify parent failed and video transitioned to FAILED with child's error code (AC 5)
    const failedVideo = expectOk(await repositories.videos.findById(videoId));
    expect(failedVideo?.status).toBe('FAILED');
    expect(failedVideo?.errorCode).toBe('FFMPEG_FAILED');

    // 4. Verify other children's outputs left in place (AC 5: documented)
    expect(
      await storage.headObject('public', `videos/${videoId}/hls/720p/index.m3u8`)
    ).toBeTruthy();
    const finalRends = expectOk(await repositories.renditions.findByVideoId(videoId));
    expect(finalRends.find((r: any) => r.name === '720p')?.status).toBe('DONE');
    expect(finalRends.find((r: any) => r.name === '480p')?.status).toBe('FAILED');
  });
});
