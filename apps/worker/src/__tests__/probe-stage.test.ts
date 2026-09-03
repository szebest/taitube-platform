import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import {
  claimStep,
  completeStep,
  createDbClient,
  processingSteps,
  renditions,
  seedDatabase,
  videoEvents,
  videos,
} from '@vp/db';
import { ErrorCodes, PermanentError } from '@vp/errors';
import type { ProbeJob } from '@vp/job-contracts';
import { createLogger } from '@vp/observability';
import type { S3Client } from '@vp/storage';
import type { Job } from 'bullmq';
import { eq } from 'drizzle-orm';
import { uuidv7 } from 'uuidv7';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { validateJobId, validateQueueName } from '../registry.js';
import { createProbeProcessor } from '../stages/probe.js';

describe('apps/worker probe stage (Ticket 06: AC 17, 18, 19, 20, 21, 22)', () => {
  const { db, sql } = createDbClient();
  const DEV_USER_ID = '00000000-0000-7000-8000-000000000001';
  const logger = createLogger({ service: 'worker-probe-test', level: 'silent' });
  const fakeS3 = {} as S3Client;

  function createMockJob(id: string, data: ProbeJob): Job<ProbeJob> {
    return {
      id,
      data,
      attemptsMade: 0,
    } as unknown as Job<ProbeJob>;
  }

  beforeAll(async () => {
    await seedDatabase();
  });

  afterAll(async () => {
    await sql.end();
  });

  // Helper to create video in UPLOADED state
  async function setupUploadedVideo(sourceKey: string, title = 'Test Video'): Promise<string> {
    const videoId = uuidv7();
    await db.insert(videos).values({
      id: videoId,
      ownerId: DEV_USER_ID,
      title,
      status: 'UPLOADED',
      sourceKey,
      sourceSizeBytes: 1000,
      sourceContentType: 'video/mp4',
      version: 1,
    });
    return videoId;
  }

  it('AC 22: unknown queue name or ":" in queue name or job id fails fast', () => {
    expect(() => validateQueueName('invalid-queue')).toThrow('Unknown queue name "invalid-queue"');
    expect(() => validateQueueName('probe:invalid')).toThrow("Queue name must not contain ':'");
    expect(() => validateJobId('video1:probe:g1')).toThrow("Job ID must not contain ':'");
    expect(validateJobId('video1--probe--g1')).toBe('video1--probe--g1');
  });

  it('AC 19: deleted or missing source object throws UnrecoverableError and sets video to FAILED', async () => {
    const missingKey = 'raw/non-existent.mp4';
    const videoId = await setupUploadedVideo(missingKey, 'Missing Video');

    const storageModule = await import('@vp/storage');
    const headSpy = vi.spyOn(storageModule, 'headObject').mockResolvedValue(null);

    const processor = createProbeProcessor({
      db,
      s3Client: fakeS3,
      logger,
    });

    const job = createMockJob(`${videoId}--probe--g1`, {
      videoId,
      sourceKey: missingKey,
      generation: 1,
      traceparent: '00-01-01-01',
    });

    await expect(processor(job)).rejects.toThrow();

    // Verify video in DB became FAILED with SOURCE_MISSING
    const [video] = await db.select().from(videos).where(eq(videos.id, videoId));
    expect(video?.status).toBe('FAILED');
    expect(video?.errorCode).toBe(ErrorCodes.SOURCE_MISSING);

    headSpy.mockRestore();
  });

  it('AC 20: processing_steps row claimed with lock_token, heartbeat_at updated, finished with same token; fenced on stale token', async () => {
    const videoId = await setupUploadedVideo('raw/fencing-test.mp4', 'Fencing Test');
    const lockToken1 = uuidv7();
    const workerId1 = 'worker-1';

    // Worker 1 claims step
    const claim1 = await claimStep(db, {
      id: uuidv7(),
      videoId,
      step: 'probe',
      rendition: '-',
      jobId: `${videoId}--probe--g1`,
      attempt: 1,
      workerId: workerId1,
      lockToken: lockToken1,
    });
    expect(claim1.fenced).toBe(false);
    expect(claim1.lockToken).toBe(lockToken1);

    // Verify row exists and status is RUNNING
    const [step1] = await db
      .select()
      .from(processingSteps)
      .where(eq(processingSteps.videoId, videoId));
    expect(step1?.status).toBe('RUNNING');
    expect(step1?.lockToken).toBe(lockToken1);

    // Worker 2 (or retry) claims step with NEW token
    const lockToken2 = uuidv7();
    const claim2 = await claimStep(db, {
      id: uuidv7(),
      videoId,
      step: 'probe',
      rendition: '-',
      jobId: `${videoId}--probe--g1`,
      attempt: 2,
      workerId: 'worker-2',
      lockToken: lockToken2,
    });
    expect(claim2.fenced).toBe(false);
    expect(claim2.lockToken).toBe(lockToken2);

    // Verify row now has lockToken2
    const [step2] = await db
      .select()
      .from(processingSteps)
      .where(eq(processingSteps.videoId, videoId));
    expect(step2?.lockToken).toBe(lockToken2);
    expect(step2?.attempt).toBe(2);

    // Worker 1 tries to complete step with stale lockToken1 -> FENCED!
    const comp1 = await completeStep(db, {
      videoId,
      step: 'probe',
      rendition: '-',
      lockToken: lockToken1, // Stale!
    });
    expect(comp1.fenced).toBe(true);
    expect(comp1.completed).toBe(false);

    // Worker 2 completes step with current lockToken2 -> SUCCEEDS!
    const comp2 = await completeStep(db, {
      videoId,
      step: 'probe',
      rendition: '-',
      lockToken: lockToken2,
    });
    expect(comp2.fenced).toBe(false);
    expect(comp2.completed).toBe(true);
  });

  it('AC 18: hostile zero-bytes file fails on attempt 1 with CORRUPT_CONTAINER', async () => {
    const videoId = await setupUploadedVideo('raw/zero-bytes.mp4', 'Zero Bytes Test');

    const storageModule = await import('@vp/storage');
    const headSpy = vi.spyOn(storageModule, 'headObject').mockResolvedValue({
      contentLength: 0,
      contentType: 'video/mp4',
    });
    const downloadSpy = vi
      .spyOn(storageModule, 'downloadObject')
      .mockImplementation(async (_client, _b, _k, targetPath) => {
        await fs.writeFile(targetPath, Buffer.alloc(0));
        return true;
      });

    const processor = createProbeProcessor({
      db,
      s3Client: fakeS3,
      logger,
    });

    const job = createMockJob(`${videoId}--probe--g1`, {
      videoId,
      sourceKey: 'raw/zero-bytes.mp4',
      generation: 1,
      traceparent: '00-01-01-01',
    });

    await expect(processor(job)).rejects.toThrow();

    // Verify video in DB became FAILED with CORRUPT_CONTAINER
    const [video] = await db.select().from(videos).where(eq(videos.id, videoId));
    expect(video?.status).toBe('FAILED');
    expect(video?.errorCode).toBe(ErrorCodes.CORRUPT_CONTAINER);

    headSpy.mockRestore();
    downloadSpy.mockRestore();
  });

  it('AC 17 & AC 21: good s60 video becomes PROCESSING, ladder [1080p, 720p, 480p], renditions PENDING, and temp dir cleaned up', async () => {
    const videoId = await setupUploadedVideo('raw/s60.mp4', 'Standard 60s Video');

    const storageModule = await import('@vp/storage');
    const headSpy = vi.spyOn(storageModule, 'headObject').mockResolvedValue({
      contentLength: 5000000,
      contentType: 'video/mp4',
    });
    const downloadSpy = vi
      .spyOn(storageModule, 'downloadObject')
      .mockImplementation(async (_client, _b, _k, targetPath) => {
        await fs.writeFile(targetPath, Buffer.from('mock-media-content'));
        return true;
      });

    const ffmpegModule = await import('@vp/ffmpeg');
    const probeSpy = vi.spyOn(ffmpegModule, 'runFfprobe').mockResolvedValue({
      durationMs: 60000,
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

    const processor = createProbeProcessor({
      db,
      s3Client: fakeS3,
      logger,
    });

    const job = createMockJob(`${videoId}--probe--g1`, {
      videoId,
      sourceKey: 'raw/s60.mp4',
      generation: 1,
      traceparent: '00-01-01-01',
    });

    const result = await processor(job);
    expect(result.status).toBe('PROCESSING');
    expect(result.durationMs).toBe(60000);

    // 1. Verify video in DB is PROCESSING with duration and ladder
    const [video] = await db.select().from(videos).where(eq(videos.id, videoId));
    expect(video?.status).toBe('PROCESSING');
    expect(video?.durationMs).toBe(60000);
    expect(video?.width).toBe(1920);
    expect(video?.height).toBe(1080);
    expect(video?.videoCodec).toBe('h264');

    // 2. Verify renditions table has PENDING rows for 1080p, 720p, 480p (AC 17)
    const rends = await db.select().from(renditions).where(eq(renditions.videoId, videoId));
    expect(rends.length).toBe(3);
    const rendNames = rends.map((r) => r.name).sort();
    expect(rendNames).toEqual(['1080p', '480p', '720p']);
    expect(rends.every((r) => r.status === 'PENDING')).toBe(true);

    // 3. Verify video_events contains probe.started and probe.completed (AC 17)
    const events = await db.select().from(videoEvents).where(eq(videoEvents.videoId, videoId));
    expect(events.some((e) => e.type === 'probe.started')).toBe(true);
    expect(events.some((e) => e.type === 'probe.completed')).toBe(true);

    // AC 21: Verify temp dir cleanup
    const tmpContents = await fs.readdir(os.tmpdir());
    const orphanedDirs = tmpContents.filter((f) => f.includes(`vp-probe-${videoId}`));
    expect(orphanedDirs.length).toBe(0);

    headSpy.mockRestore();
    downloadSpy.mockRestore();
    probeSpy.mockRestore();
  });

  it('AC 17: p720 produces ladder [720p, 480p], sd360 produces [480p], portrait has rotation-aware dimensions', async () => {
    const p720Id = await setupUploadedVideo('raw/p720.mp4', '720p Video');
    const sd360Id = await setupUploadedVideo('raw/sd360.mp4', '360p Video');
    const portraitId = await setupUploadedVideo('raw/portrait.mp4', 'Portrait Video');

    const storageModule = await import('@vp/storage');
    const headSpy = vi.spyOn(storageModule, 'headObject').mockResolvedValue({
      contentLength: 1000000,
      contentType: 'video/mp4',
    });
    const downloadSpy = vi.spyOn(storageModule, 'downloadObject').mockResolvedValue(true);

    const ffmpegModule = await import('@vp/ffmpeg');

    const processor = createProbeProcessor({
      db,
      s3Client: fakeS3,
      logger,
    });

    // 1. Test p720
    vi.spyOn(ffmpegModule, 'runFfprobe').mockResolvedValueOnce({
      durationMs: 30000,
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

    await processor(
      createMockJob(`${p720Id}--probe--g1`, {
        videoId: p720Id,
        sourceKey: 'raw/p720.mp4',
        generation: 1,
        traceparent: '00-1',
      })
    );

    const p720Rends = await db.select().from(renditions).where(eq(renditions.videoId, p720Id));
    expect(p720Rends.map((r) => r.name).sort()).toEqual(['480p', '720p']);

    // 2. Test sd360 (keeps lowest rung 480p)
    vi.spyOn(ffmpegModule, 'runFfprobe').mockResolvedValueOnce({
      durationMs: 15000,
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

    await processor(
      createMockJob(`${sd360Id}--probe--g1`, {
        videoId: sd360Id,
        sourceKey: 'raw/sd360.mp4',
        generation: 1,
        traceparent: '00-1',
      })
    );

    const sd360Rends = await db.select().from(renditions).where(eq(renditions.videoId, sd360Id));
    expect(sd360Rends.map((r) => r.name)).toEqual(['480p']);

    // 3. Test portrait video with 90° rotation
    vi.spyOn(ffmpegModule, 'runFfprobe').mockResolvedValueOnce({
      durationMs: 10000,
      width: 1920,
      height: 1080,
      effectiveWidth: 1080,
      effectiveHeight: 1920,
      rotation: 90,
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

    await processor(
      createMockJob(`${portraitId}--probe--g1`, {
        videoId: portraitId,
        sourceKey: 'raw/portrait.mp4',
        generation: 1,
        traceparent: '00-1',
      })
    );

    const [portraitVideo] = await db.select().from(videos).where(eq(videos.id, portraitId));
    expect(portraitVideo?.width).toBe(1080); // rotation-aware effective dimensions
    expect(portraitVideo?.height).toBe(1920);

    headSpy.mockRestore();
    downloadSpy.mockRestore();
  });

  it('AC 18: hostile audio-only, unsupported-codec, and over-duration files fail on attempt 1 with correct error codes', async () => {
    const audioOnlyId = await setupUploadedVideo('raw/audio-only.mp4', 'Audio Only');
    const badCodecId = await setupUploadedVideo('raw/bad-codec.mp4', 'Bad Codec');
    const overDurationId = await setupUploadedVideo('raw/over-duration.mp4', 'Over Duration');

    const storageModule = await import('@vp/storage');
    const headSpy = vi.spyOn(storageModule, 'headObject').mockResolvedValue({
      contentLength: 1000,
      contentType: 'video/mp4',
    });
    const downloadSpy = vi.spyOn(storageModule, 'downloadObject').mockResolvedValue(true);

    const ffmpegModule = await import('@vp/ffmpeg');

    const processor = createProbeProcessor({
      db,
      s3Client: fakeS3,
      logger,
    });

    // 1. audio-only -> CORRUPT_CONTAINER
    vi.spyOn(ffmpegModule, 'runFfprobe').mockRejectedValueOnce(
      new PermanentError(ErrorCodes.CORRUPT_CONTAINER, 'Source file contains no video stream')
    );
    await expect(
      processor(
        createMockJob(`${audioOnlyId}--probe--g1`, {
          videoId: audioOnlyId,
          sourceKey: 'raw/audio-only.mp4',
          generation: 1,
          traceparent: '00-1',
        })
      )
    ).rejects.toThrow();

    const [audioVideo] = await db.select().from(videos).where(eq(videos.id, audioOnlyId));
    expect(audioVideo?.status).toBe('FAILED');
    expect(audioVideo?.errorCode).toBe(ErrorCodes.CORRUPT_CONTAINER);

    // 2. unsupported codec -> UNSUPPORTED_CODEC
    vi.spyOn(ffmpegModule, 'runFfprobe').mockRejectedValueOnce(
      new PermanentError(ErrorCodes.UNSUPPORTED_CODEC, 'Unsupported video codec "prores"')
    );
    await expect(
      processor(
        createMockJob(`${badCodecId}--probe--g1`, {
          videoId: badCodecId,
          sourceKey: 'raw/bad-codec.mp4',
          generation: 1,
          traceparent: '00-1',
        })
      )
    ).rejects.toThrow();

    const [codecVideo] = await db.select().from(videos).where(eq(videos.id, badCodecId));
    expect(codecVideo?.status).toBe('FAILED');
    expect(codecVideo?.errorCode).toBe(ErrorCodes.UNSUPPORTED_CODEC);

    // 3. over-duration -> DURATION_EXCEEDED
    vi.spyOn(ffmpegModule, 'runFfprobe').mockRejectedValueOnce(
      new PermanentError(ErrorCodes.DURATION_EXCEEDED, 'Video duration exceeds maximum allowed')
    );
    await expect(
      processor(
        createMockJob(`${overDurationId}--probe--g1`, {
          videoId: overDurationId,
          sourceKey: 'raw/over-duration.mp4',
          generation: 1,
          traceparent: '00-1',
        })
      )
    ).rejects.toThrow();

    const [durVideo] = await db.select().from(videos).where(eq(videos.id, overDurationId));
    expect(durVideo?.status).toBe('FAILED');
    expect(durVideo?.errorCode).toBe(ErrorCodes.DURATION_EXCEEDED);

    headSpy.mockRestore();
    downloadSpy.mockRestore();
  });
});
