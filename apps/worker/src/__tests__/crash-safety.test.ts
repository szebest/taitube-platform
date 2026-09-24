import { InMemoryRepositories, InMemoryStorageClient } from '@vp/adapters/in-memory';
import { JobQueue, type QueueJob } from '@vp/core/ports';
import type { PackageJob } from '@vp/job-contracts';
import { createLogger } from '@vp/logger';
import { ok } from '@vp/result';
import { expectOk } from '@vp/testing/result';
import { uuidv7 } from 'uuidv7';
import { createPackageProcessor } from '../stages/package';
import { STAGE_SETTINGS } from './stage-settings';

describe('crash safety and effectively-once completion', () => {
  let repositories: InMemoryRepositories;
  let storage: InMemoryStorageClient;
  const DEV_USER_ID = '00000000-0000-7000-8000-000000000001';
  const logger = createLogger({ format: 'json', service: 'worker-crash-test', level: 'silent' });

  function createMockJob<T>(id: string, data: T, attemptsMade = 0): QueueJob<T> {
    return {
      id,
      name: 'job',
      data,
      attemptsMade,
      updateProgress: vi.fn().mockResolvedValue(undefined),
    };
  }

  beforeEach(() => {
    repositories = new InMemoryRepositories();
    storage = new InMemoryStorageClient();
  });

  async function setupProcessingVideo(sourceKey: string): Promise<string> {
    const videoId = uuidv7();
    await repositories.videos.create({
      id: videoId,
      ownerId: DEV_USER_ID,
      title: 'Crash Safety Video',
      status: 'PROCESSING',
      sourceKey,
      sourceSizeBytes: 5000000,
      durationMs: 60000,
    });
    return videoId;
  }

  it('fences out a zombie transcode completion after a second worker claims the step', async () => {
    const videoId = await setupProcessingVideo('raw/zombie-transcode.mp4');

    await repositories.renditions.create({
      id: uuidv7(),
      videoId,
      name: '720p',
      width: 1280,
      height: 720,
      videoBitrateKbps: 2800,
      audioBitrateKbps: 128,
      status: 'PENDING',
    });

    const lockToken1 = uuidv7();
    const claim1 = await repositories.steps.claim({
      id: uuidv7(),
      videoId,
      step: 'transcode',
      rendition: '720p',
      jobId: `${videoId}--transcode--720p--g1`,
      attempt: 1,
      workerId: 'worker-zombie',
      lockToken: lockToken1,
    });
    expect(expectOk(claim1).fenced).toBe(false);

    const lockToken2 = uuidv7();
    const claim2 = await repositories.steps.claim({
      id: uuidv7(),
      videoId,
      step: 'transcode',
      rendition: '720p',
      jobId: `${videoId}--transcode--720p--g1`,
      attempt: 2,
      workerId: 'worker-fresh',
      lockToken: lockToken2,
    });
    expect(expectOk(claim2).fenced).toBe(false);

    const complete2 = await repositories.steps.complete({
      videoId,
      step: 'transcode',
      rendition: '720p',
      lockToken: lockToken2,
      result: { segmentCount: 10, bytes: 50000 },
    });
    expect(expectOk(complete2).fenced).toBe(false);
    expect(expectOk(complete2).completed).toBe(true);

    const complete1 = await repositories.steps.complete({
      videoId,
      step: 'transcode',
      rendition: '720p',
      lockToken: lockToken1,
      result: { segmentCount: 10, bytes: 50000 },
    });

    expect(expectOk(complete1).fenced).toBe(true);
    expect(expectOk(complete1).completed).toBe(false);

    const steps = expectOk(await repositories.steps.findByVideoId(videoId));
    const step = steps.find((s) => s.step === 'transcode' && s.rendition === '720p');
    expect(step?.workerId).toBe('worker-fresh');
    expect(step?.attempt).toBe(2);
    expect(step?.status).toBe('DONE');
  });

  it('a re-run package job leaves exactly one READY transition, video.ready event and notify job', async () => {
    const videoId = await setupProcessingVideo('raw/effectively-once.mp4');

    await storage.uploadObject({
      bucket: 'public',
      key: `videos/${videoId}/hls/720p/index.m3u8`,
      body: Buffer.from('#EXTM3U\n'),
      contentType: 'application/vnd.apple.mpegurl',
    });

    const enqueuedJobs: string[] = [];
    class MockCrashQueue extends JobQueue {
      async checkHealth() {
        return ok();
      }
      getName() {
        return 'notify';
      }
      async add<T = unknown>(name: string, data: T) {
        enqueuedJobs.push(name);
        return ok({ id: 'mock-id', name, data, attemptsMade: 0 });
      }
      async process() {
        return ok();
      }
      async getJobState() {
        return ok(undefined);
      }
      async isPaused() {
        return ok(false);
      }
      async pause() {
        return ok();
      }
      async resume() {
        return ok();
      }
      async getJobCounts() {
        return ok({
          active: 0,
          completed: 0,
          failed: 0,
          delayed: 0,
          waiting: 0,
          prioritized: 0,
        });
      }
      async getJobs() {
        return ok([]);
      }
      async close() {
        return ok();
      }
    }
    const mockQueue = new MockCrashQueue();

    const processor = createPackageProcessor({
      ...STAGE_SETTINGS,
      repositories,
      storage,
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

    await processor(job);

    const v1 = expectOk(await repositories.videos.findById(videoId));
    expect(v1?.status).toBe('READY');

    const events1 = expectOk(await repositories.events.findByVideoId(videoId));
    const readyEvents1 = events1.filter((e) => e.type === 'video.ready');
    expect(readyEvents1.length).toBe(1);

    const duplicateJob = createMockJob<PackageJob>(`${videoId}--package--g1`, job.data, 1);
    await processor(duplicateJob);

    const events2 = expectOk(await repositories.events.findByVideoId(videoId));
    const readyEvents2 = events2.filter((e) => e.type === 'video.ready');
    expect(readyEvents2.length).toBe(1);

    expect(enqueuedJobs.filter((name) => name === 'notify').length).toBe(1);
  });
});
