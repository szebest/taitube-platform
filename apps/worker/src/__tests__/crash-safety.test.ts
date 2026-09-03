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
import type { PackageJob } from '@vp/job-contracts';
import { createLogger } from '@vp/observability';
import type { S3Client } from '@vp/storage';
import type { Job, Queue } from 'bullmq';
import { eq } from 'drizzle-orm';
import { uuidv7 } from 'uuidv7';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createPackageProcessor } from '../stages/package.js';

describe('apps/worker crash safety & effectively-once guarantees (Ticket 09: AC 17, 18)', () => {
  const { db, sql } = createDbClient();
  const DEV_USER_ID = '00000000-0000-7000-8000-000000000001';
  const logger = createLogger({ service: 'worker-crash-test', level: 'silent' });
  const fakeS3 = {} as S3Client;

  function createMockJob<T>(id: string, data: T, attemptsMade = 0): Job<T> {
    return {
      id,
      data,
      attemptsMade,
      updateProgress: vi.fn().mockResolvedValue(undefined),
    } as unknown as Job<T>;
  }

  beforeAll(async () => {
    await seedDatabase();
  });

  afterAll(async () => {
    await sql.end();
  });

  async function setupProcessingVideo(sourceKey: string): Promise<string> {
    const videoId = uuidv7();
    await db.insert(videos).values({
      id: videoId,
      ownerId: DEV_USER_ID,
      title: 'Crash Safety Video',
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

  it('AC 18: zombie transcode worker completion is fenced out after second worker claims step', async () => {
    const videoId = await setupProcessingVideo('raw/zombie-transcode.mp4');

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

    // 1. Worker 1 (zombie) claims step with lockToken1
    const lockToken1 = uuidv7();
    const claim1 = await claimStep(db, {
      id: uuidv7(),
      videoId,
      step: 'transcode',
      rendition: '720p',
      jobId: `${videoId}--transcode--720p--g1`,
      attempt: 1,
      workerId: 'worker-zombie',
      lockToken: lockToken1,
    });
    expect(claim1.fenced).toBe(false);

    // 2. Worker 2 (fresh) claims step with lockToken2 (e.g. after worker 1 crashed/stalled)
    const lockToken2 = uuidv7();
    const claim2 = await claimStep(db, {
      id: uuidv7(),
      videoId,
      step: 'transcode',
      rendition: '720p',
      jobId: `${videoId}--transcode--720p--g1`,
      attempt: 2,
      workerId: 'worker-fresh',
      lockToken: lockToken2,
    });
    expect(claim2.fenced).toBe(false);

    // 3. Worker 2 completes successfully with lockToken2
    const complete2 = await completeStep(db, {
      videoId,
      step: 'transcode',
      rendition: '720p',
      lockToken: lockToken2,
      result: { segmentCount: 10, bytes: 50000 },
    });
    expect(complete2.fenced).toBe(false);
    expect(complete2.completed).toBe(true);

    // 4. Worker 1 (zombie) wakes up from partition/hang and attempts to complete with stale lockToken1
    const complete1 = await completeStep(db, {
      videoId,
      step: 'transcode',
      rendition: '720p',
      lockToken: lockToken1,
      result: { segmentCount: 10, bytes: 50000 },
    });

    // Fencing guarantee: stale token affects 0 rows and reports fenced: true
    expect(complete1.fenced).toBe(true);
    expect(complete1.completed).toBe(false);

    // Verify step remains completed by worker 2
    const [step] = await db
      .select()
      .from(processingSteps)
      .where(eq(processingSteps.videoId, videoId));
    expect(step?.workerId).toBe('worker-fresh');
    expect(step?.attempt).toBe(2);
    expect(step?.status).toBe('DONE');
  });

  it('AC 17 & 18: effectively-once package completion ensures exactly one READY transition and video.ready event', async () => {
    const videoId = await setupProcessingVideo('raw/effectively-once.mp4');

    const storageModule = await import('@vp/storage');
    const headSpy = vi.spyOn(storageModule, 'headObject').mockResolvedValue({
      contentLength: 500,
      contentType: 'application/vnd.apple.mpegurl',
    });
    const uploadSpy = vi.spyOn(storageModule, 'uploadObject').mockResolvedValue(undefined);

    const enqueuedJobs: string[] = [];
    const mockQueue = {
      add: vi.fn().mockImplementation((name) => {
        enqueuedJobs.push(name);
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

    // Run attempt 1
    await processor(job);

    // Verify video is READY and exactly one video.ready event exists
    const [v1] = await db.select().from(videos).where(eq(videos.id, videoId));
    expect(v1?.status).toBe('READY');

    const events1 = await db.select().from(videoEvents).where(eq(videoEvents.videoId, videoId));
    const readyEvents1 = events1.filter((e) => e.type === 'video.ready');
    expect(readyEvents1.length).toBe(1);

    // Simulate duplicate/zombie re-execution of package job (attempt 2)
    const duplicateJob = createMockJob<PackageJob>(`${videoId}--package--g1`, job.data, 1);
    await processor(duplicateJob);

    // Invariant: count(video_events where type='video.ready') MUST REMAIN EXACTLY 1
    const events2 = await db.select().from(videoEvents).where(eq(videoEvents.videoId, videoId));
    const readyEvents2 = events2.filter((e) => e.type === 'video.ready');
    expect(readyEvents2.length).toBe(1);

    // Invariant: notify enqueued exactly once
    expect(enqueuedJobs.filter((name) => name === 'notify').length).toBe(1);

    headSpy.mockRestore();
    uploadSpy.mockRestore();
  });
});
