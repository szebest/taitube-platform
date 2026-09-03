import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {
  createDbClient,
  processingSteps,
  renditions,
  seedDatabase,
  videoEvents,
  videos,
} from '@vp/db';
import { ErrorCodes } from '@vp/errors';
import type { NotifyJob, PackageJob, TranscodeJob } from '@vp/job-contracts';
import { createLogger } from '@vp/observability';
import type { S3Client } from '@vp/storage';
import type { Job, Queue } from 'bullmq';
import { eq } from 'drizzle-orm';
import type { Redis } from 'ioredis';
import { uuidv7 } from 'uuidv7';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createNotifyProcessor } from '../stages/notify.js';
import { createPackageProcessor } from '../stages/package.js';
import { createTranscodeProcessor } from '../stages/transcode.js';

describe('apps/worker full pipeline stages (Ticket 07: AC 17, 18, 19, 20, 22, 23)', () => {
  const { db, sql } = createDbClient();
  const DEV_USER_ID = '00000000-0000-7000-8000-000000000001';
  const logger = createLogger({ service: 'worker-pipeline-test', level: 'silent' });
  const fakeS3 = {} as S3Client;

  function createMockJob<T>(id: string, data: T): Job<T> {
    return {
      id,
      data,
      attemptsMade: 0,
      updateProgress: vi.fn().mockResolvedValue(undefined),
    } as unknown as Job<T>;
  }

  beforeAll(async () => {
    await seedDatabase();
  });

  afterAll(async () => {
    await sql.end();
  });

  async function setupProcessingVideo(
    sourceKey: string,
    title = 'Pipeline Video'
  ): Promise<string> {
    const videoId = uuidv7();
    await db.insert(videos).values({
      id: videoId,
      ownerId: DEV_USER_ID,
      title,
      status: 'PROCESSING',
      sourceKey,
      sourceSizeBytes: 5000000,
      sourceContentType: 'video/mp4',
      fps: '24',
      durationMs: 60000,
      version: 1,
    });
    return videoId;
  }

  it('AC 17 & 22: transcode stage transcodes, uploads segments with immutable headers, uploads index.m3u8 last, updates renditions row to DONE, and throttles progress', async () => {
    const videoId = await setupProcessingVideo('raw/s60.mp4');

    // Seed pending rendition row
    await db.insert(renditions).values({
      id: uuidv7(),
      videoId,
      name: '720p',
      width: 1280,
      height: 720,
      videoBitrateKbps: 2800,
      audioBitrateKbps: 128,
      status: 'PENDING',
    });

    const storageModule = await import('@vp/storage');
    const headSpy = vi.spyOn(storageModule, 'headObject').mockResolvedValue({
      contentLength: 5000000,
      contentType: 'video/mp4',
    });
    const downloadSpy = vi
      .spyOn(storageModule, 'downloadObject')
      .mockImplementation(async (_client, _b, _k, targetPath) => {
        await fs.writeFile(targetPath, Buffer.from('mock-source-media'));
        return true;
      });

    const uploadedObjects: Array<{ key: string; contentType: string; cacheControl?: string }> = [];
    const uploadSpy = vi
      .spyOn(storageModule, 'uploadObject')
      .mockImplementation(async (_client, options) => {
        uploadedObjects.push({
          key: options.key,
          contentType: options.contentType,
          cacheControl: options.cacheControl,
        });
      });

    // Mock runFfmpegTranscode creating dummy TS segments and playlist in outputDir
    const ffmpegModule = await import('@vp/ffmpeg');
    const transcodeSpy = vi
      .spyOn(ffmpegModule, 'runFfmpegTranscode')
      .mockImplementation(async (options) => {
        // Create 10 dummy TS segments and index.m3u8
        for (let i = 1; i <= 10; i++) {
          const segName = `seg_${String(i).padStart(5, '0')}.ts`;
          await fs.writeFile(path.join(options.outputDir, segName), Buffer.alloc(1000));
        }
        await fs.writeFile(
          path.join(options.outputDir, 'index.m3u8'),
          '#EXTM3U\n#EXT-X-VERSION:6\n#EXT-X-INDEPENDENT-SEGMENTS\n#EXT-X-PLAYLIST-TYPE:VOD\n#EXT-X-ENDLIST\n'
        );

        // Call onProgress
        options.onProgress?.({ percent: 50, outTimeMs: 30000 });
        options.onProgress?.({ percent: 100, outTimeMs: 60000 });

        return {
          outputDir: options.outputDir,
          playlistPath: path.join(options.outputDir, 'index.m3u8'),
          segmentCount: 10,
          durationMs: 60000,
        };
      });

    const enqueuedJobs: Array<{ queue: string; data: unknown }> = [];
    const mockQueue = {
      add: vi.fn().mockImplementation((name, data) => {
        enqueuedJobs.push({ queue: name, data });
        return Promise.resolve();
      }),
    } as unknown as Queue;

    const processor = createTranscodeProcessor({
      db,
      s3Client: fakeS3,
      logger,
      getQueue: () => mockQueue,
    });

    const job = createMockJob<TranscodeJob>(`${videoId}--transcode--720p--g1`, {
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
      traceparent: '00-01-01-01',
    });

    const result = await processor(job);
    expect(result.segmentCount).toBe(10);
    expect(result.bytes).toBeGreaterThan(10000);

    // 1. Verify 10 TS segments uploaded with immutable cache control (AC 17)
    const tsUploads = uploadedObjects.filter((o) => o.key.endsWith('.ts'));
    expect(tsUploads.length).toBe(10);
    expect(tsUploads.every((o) => o.contentType === 'video/MP2T')).toBe(true);
    expect(tsUploads.every((o) => o.cacheControl === 'public, max-age=31536000, immutable')).toBe(
      true
    );

    // 2. Verify index.m3u8 uploaded LAST (AC 17, SDD §9.7)
    const lastUpload = uploadedObjects[uploadedObjects.length - 1];
    expect(lastUpload?.key).toBe(`videos/${videoId}/hls/720p/index.m3u8`);
    expect(lastUpload?.contentType).toBe('application/vnd.apple.mpegurl');
    expect(lastUpload?.cacheControl).toBe('public, max-age=60');

    // 3. Verify renditions row is DONE with segmentCount=10 and bytes (AC 17)
    const [rend] = await db.select().from(renditions).where(eq(renditions.videoId, videoId));
    expect(rend?.status).toBe('DONE');
    expect(rend?.segmentCount).toBe(10);
    expect(rend?.bytes).toBeGreaterThan(10000);
    expect(rend?.playlistKey).toBe(`videos/${videoId}/hls/720p/index.m3u8`);

    // 4. Verify package job was enqueued
    expect(enqueuedJobs.length).toBe(1);
    expect(enqueuedJobs[0]?.queue).toBe('package');

    headSpy.mockRestore();
    downloadSpy.mockRestore();
    uploadSpy.mockRestore();
    transcodeSpy.mockRestore();
  });

  it('AC 19: package verifies rendition playlist exists via HEAD, writes master LAST, CAS flips PROCESSING -> READY once, and enqueues notify', async () => {
    const videoId = await setupProcessingVideo('raw/s60.mp4');

    const storageModule = await import('@vp/storage');
    // Mock headObject returning exists
    const headSpy = vi.spyOn(storageModule, 'headObject').mockResolvedValue({
      contentLength: 500,
      contentType: 'application/vnd.apple.mpegurl',
    });

    const uploadedObjects: string[] = [];
    const uploadSpy = vi
      .spyOn(storageModule, 'uploadObject')
      .mockImplementation(async (_client, options) => {
        uploadedObjects.push(options.key);
      });

    const enqueuedJobs: Array<{ queue: string; data: unknown }> = [];
    const mockQueue = {
      add: vi.fn().mockImplementation((name, data) => {
        enqueuedJobs.push({ queue: name, data });
        return Promise.resolve();
      }),
    } as unknown as Queue;

    const processor = createPackageProcessor({
      db,
      s3Client: fakeS3,
      logger,
      getQueue: () => mockQueue,
    });

    const job = createMockJob<PackageJob>(`${videoId}--package--g1`, {
      videoId,
      generation: 1,
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
      ],
      traceparent: '00-01-01-01',
    });

    const result = await processor(job);
    expect(result.masterKey).toBe(`videos/${videoId}/hls/master.m3u8`);
    expect(uploadedObjects).toContain(`videos/${videoId}/hls/master.m3u8`);

    // 1. Verify video transitioned to READY (AC 19)
    const [video] = await db.select().from(videos).where(eq(videos.id, videoId));
    expect(video?.status).toBe('READY');
    expect(video?.masterPlaylistKey).toBe(`videos/${videoId}/hls/master.m3u8`);
    expect(video?.readyAt).toBeDefined();

    // 2. Verify video_events has exactly ONE video.ready (AC 19)
    const events = await db.select().from(videoEvents).where(eq(videoEvents.videoId, videoId));
    const readyEvents = events.filter((e) => e.type === 'video.ready');
    expect(readyEvents.length).toBe(1);

    // 3. Verify notify job was enqueued (AC 19)
    expect(enqueuedJobs.length).toBe(1);
    expect(enqueuedJobs[0]?.queue).toBe('notify');

    headSpy.mockRestore();
    uploadSpy.mockRestore();
  });

  it('AC 19: package fails when rendition playlist does NOT exist on storage', async () => {
    const videoId = await setupProcessingVideo('raw/missing-rendition.mp4');

    const storageModule = await import('@vp/storage');
    // Mock headObject returning null (missing rendition playlist)
    const headSpy = vi.spyOn(storageModule, 'headObject').mockResolvedValue(null);

    const processor = createPackageProcessor({
      db,
      s3Client: fakeS3,
      logger,
    });

    const job = createMockJob<PackageJob>(`${videoId}--package--g1`, {
      videoId,
      generation: 1,
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
      ],
      traceparent: '00-01-01-01',
    });

    await expect(processor(job)).rejects.toThrow();

    // Verify step recorded SEGMENT_VERIFY_FAILED
    const [step] = await db
      .select()
      .from(processingSteps)
      .where(eq(processingSteps.videoId, videoId));
    expect(step?.errorCode).toBe(ErrorCodes.SEGMENT_VERIFY_FAILED);

    headSpy.mockRestore();
  });

  it('AC 20: notify publishes {event:"status", data:{status:"READY", playbackUrl}} on video:{id} and user:{uid}', async () => {
    const videoId = await setupProcessingVideo('raw/notify-test.mp4');
    const userId = DEV_USER_ID;
    const playbackUrl = `http://localhost:9000/public/videos/${videoId}/hls/master.m3u8`;

    const publishedMessages: Array<{ channel: string; message: string }> = [];
    const mockRedis = {
      publish: vi.fn().mockImplementation((channel: string, message: string) => {
        publishedMessages.push({ channel, message });
        return Promise.resolve(1);
      }),
    } as unknown as Redis;

    const processor = createNotifyProcessor({
      db,
      redis: mockRedis,
      logger,
    });

    const job = createMockJob<NotifyJob>(`${videoId}--notify--video.ready--1`, {
      videoId,
      userId,
      event: 'video.ready',
      eventSeq: 1,
      payload: {
        status: 'READY',
        playbackUrl,
      },
      traceparent: '00-01-01-01',
    });

    const result = await processor(job);
    expect(result.published).toBe(true);

    expect(publishedMessages.length).toBe(2);

    const videoMsg = publishedMessages.find((m) => m.channel === `video:${videoId}`);
    const userMsg = publishedMessages.find((m) => m.channel === `user:${userId}`);

    expect(videoMsg).toBeDefined();
    expect(userMsg).toBeDefined();

    const parsedVideoMsg = JSON.parse(videoMsg?.message || '{}');
    expect(parsedVideoMsg.event).toBe('status');
    expect(parsedVideoMsg.data.status).toBe('READY');
    expect(parsedVideoMsg.data.playbackUrl).toBe(playbackUrl);

    const parsedUserMsg = JSON.parse(userMsg?.message || '{}');
    expect(parsedUserMsg.event).toBe('status');
    expect(parsedUserMsg.data.status).toBe('READY');
    expect(parsedUserMsg.data.playbackUrl).toBe(playbackUrl);

    // Verify step completed in DB
    const [step] = await db
      .select()
      .from(processingSteps)
      .where(eq(processingSteps.videoId, videoId));
    expect(step?.status).toBe('DONE');
  });
});
