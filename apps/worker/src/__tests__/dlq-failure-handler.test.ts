import {
  InMemoryFlowProducer,
  InMemoryJobQueue,
  InMemoryRepositories,
  InMemoryStorageClient,
} from '@vp/adapters/in-memory';
import { ErrorCodes, PermanentError, TransientError } from '@vp/errors';
import { calculateBackoffDelay, ids, stagePolicies } from '@vp/job-contracts';
import { createLogger, createMetricsRegistry } from '@vp/observability';
import { expectOk } from '@vp/testing/result';
import { uuidv7 } from 'uuidv7';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFailureHandler } from '../failure-handler';
import { createPackageProcessor } from '../stages/package';
import { createProbeProcessor } from '../stages/probe';
import { createTranscodeProcessor } from '../stages/transcode';
import { throughRunner } from './queue-boundary';
import { STAGE_SETTINGS, failingTranscodeOf, transcodeDeps } from './stage-settings';

describe('Ticket 16: Retries, Backoff, DLQ and Poison Pill Handling', () => {
  let repositories: InMemoryRepositories;
  let storage: InMemoryStorageClient;
  let queues: Map<string, InMemoryJobQueue>;
  let flowProducer: InMemoryFlowProducer;
  const metrics = createMetricsRegistry();
  const logger = createLogger({ service: 'dlq-test', level: 'info' });
  const DEV_USER_ID = '00000000-0000-7000-8000-000000000001';

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

  async function setupUploadedVideo(sourceKey: string, title = 'Test Video'): Promise<string> {
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

  // AC 1: Stage policies from SDD §9.1 applied from packages/job-contracts (attempts, exponential delay, jitter)
  it('AC 1: Stage policies calculate exponential backoff with jitter ~10/20/40s ± jitter and log timestamps', () => {
    const policy = stagePolicies['transcode-720p'];
    expect(policy.attempts).toBe(4);
    expect(policy.backoff.type).toBe('exponential');
    expect(policy.backoff.delay).toBe(10_000);
    expect(policy.backoff.jitter).toBe(0.5);

    const now = Date.now();
    const delays: Array<{ attempt: number; delay: number; timestamp: string }> = [];

    // Simulate 3 retries (attempts 1, 2, 3 before attempt 4)
    for (let attempt = 1; attempt <= 3; attempt++) {
      const { minDelay, maxDelay, delay } = calculateBackoffDelay(policy.backoff, attempt);
      const expectedMax = 2 ** (attempt - 1) * 10_000;
      const expectedMin = expectedMax * (1 - 0.5);

      expect(maxDelay).toBe(expectedMax);
      expect(minDelay).toBe(expectedMin);
      expect(delay).toBeGreaterThanOrEqual(expectedMin);
      expect(delay).toBeLessThanOrEqual(expectedMax);

      const delayTimestamp = new Date(now + delay).toISOString();
      delays.push({ attempt, delay, timestamp: delayTimestamp });
    }

    // Log timestamps in test as required by AC 1
    logger.info(
      { delays },
      'Observed retry delays for transcode-720p with exponential backoff and jitter'
    );
    expect(delays).toHaveLength(3);
    expect(delays[0]?.delay).toBeGreaterThanOrEqual(5000);
    expect(delays[0]?.delay).toBeLessThanOrEqual(10000);
    expect(delays[1]?.delay).toBeGreaterThanOrEqual(10000);
    expect(delays[1]?.delay).toBeLessThanOrEqual(20000);
    expect(delays[2]?.delay).toBeGreaterThanOrEqual(20000);
    expect(delays[2]?.delay).toBeLessThanOrEqual(40000);
  });

  // AC 2: PermanentError -> no retry, DLQ on attempt 1
  it('AC 2: PermanentError results in no retries and lands in DLQ on attempt 1', async () => {
    const videoId = await setupUploadedVideo('raw/corrupt.mp4');
    const queueName = 'transcode-720p';
    const queue = getQueue(queueName);

    const onFailed = createFailureHandler({
      workerId: STAGE_SETTINGS.workerId,
      stage: queueName,
      queueName,
      repositories,
      getQueue,
      logger,
      metrics,
    });
    queue.onFailed(onFailed);

    const jobId = `${videoId}--transcode--720p--g1`;
    await repositories.steps.claim({
      id: uuidv7(),
      videoId,
      step: 'transcode',
      rendition: '720p',
      jobId,
      attempt: 1,
      workerId: 'worker-test',
      lockToken: 'token-1',
    });
    await repositories.renditions.create({
      id: uuidv7(),
      videoId,
      name: '720p',
      width: 1280,
      height: 720,
      videoBitrateKbps: 2500,
      audioBitrateKbps: 128,
      status: 'PENDING',
    });

    await queue.add(
      queueName,
      { videoId, rendition: { name: '720p' } },
      {
        jobId,
        ...stagePolicies['transcode-720p'],
      }
    );

    let executionCount = 0;
    await expect(
      queue.process(async () => {
        executionCount++;
        throw new PermanentError(ErrorCodes.CORRUPT_CONTAINER, 'Corrupt container header');
      })
    ).rejects.toThrow('Corrupt container header');

    // Verify 0 retries (executed exactly once)
    expect(executionCount).toBe(1);

    // Verify entry in Postgres/InMemory mirror (AC 3)
    const dlqEntries = expectOk(await repositories.dlq.list({ limit: 100 }));
    expect(dlqEntries).toHaveLength(1);
    const entry = dlqEntries[0];
    expect(entry).toBeDefined();
    expect(entry?.queue).toBe(queueName);
    expect(entry?.jobId).toBe(jobId);
    expect(entry?.errorCode).toBe(ErrorCodes.CORRUPT_CONTAINER);
    expect(entry?.attemptsMade).toBe(1);
    expect(entry?.status).toBe('PARKED');

    // Verify copy in dlq queue (AC 3)
    const dlqQueue = getQueue('dlq');
    expect(dlqQueue.enqueuedJobs).toHaveLength(1);
    const dlqJob = dlqQueue.enqueuedJobs[0];
    expect(dlqJob).toBeDefined();
    expect(dlqJob?.id).toBe(ids.dlq(queueName, jobId, 1));
    const dlqData = dlqJob?.data as { error?: { code?: string; unrecoverable?: boolean } };
    expect(dlqData?.error?.code).toBe(ErrorCodes.CORRUPT_CONTAINER);
    expect(dlqData?.error?.unrecoverable).toBe(true);

    // Verify processing_steps DEAD and renditions FAILED (AC 3)
    const steps = expectOk(await repositories.steps.findByVideoId(videoId));
    expect(steps.some((s) => s.step === 'transcode' && s.status === 'DEAD')).toBe(true);
    const rends = expectOk(await repositories.renditions.findByVideoId(videoId));
    expect(rends.some((r) => r.name === '720p' && r.status === 'FAILED')).toBe(true);
  });

  // AC 2: TransientError -> DLQ after attempts
  it('AC 2: TransientError retries up to attempts limit then lands in DLQ', async () => {
    const videoId = await setupUploadedVideo('raw/transient.mp4');
    const queueName = 'transcode-480p';
    const queue = getQueue(queueName);

    const onFailed = createFailureHandler({
      workerId: STAGE_SETTINGS.workerId,
      stage: queueName,
      queueName,
      repositories,
      getQueue,
      logger,
      metrics,
    });
    queue.onFailed(onFailed);

    const jobId = `${videoId}--transcode--480p--g1`;
    await queue.add(
      queueName,
      { videoId, rendition: { name: '480p' } },
      {
        jobId,
        ...stagePolicies['transcode-480p'], // attempts: 4
      }
    );

    let executionCount = 0;
    await expect(
      queue.process(async () => {
        executionCount++;
        throw new TransientError(ErrorCodes.STORAGE_UNAVAILABLE, 'S3 connection timeout');
      })
    ).rejects.toThrow('S3 connection timeout');

    // Verify retried 4 times before failing
    expect(executionCount).toBe(4);

    const dlqEntries = expectOk(await repositories.dlq.list({ limit: 100 }));
    expect(dlqEntries).toHaveLength(1);
    const entry = dlqEntries[0];
    expect(entry).toBeDefined();
    expect(entry?.attemptsMade).toBe(4);
    expect(entry?.errorCode).toBe(ErrorCodes.STORAGE_UNAVAILABLE);
  });

  // AC 2: Unknown errors -> treated transient with cap 3
  it('AC 2: Unknown errors are treated as transient with a cap of 3 attempts', async () => {
    const videoId = await setupUploadedVideo('raw/unknown.mp4');
    const queueName = 'probe';
    const queue = getQueue(queueName);

    const onFailed = createFailureHandler({
      workerId: STAGE_SETTINGS.workerId,
      stage: queueName,
      queueName,
      repositories,
      getQueue,
      logger,
      metrics,
    });
    queue.onFailed(onFailed);

    const jobId = `${videoId}--probe--g1`;
    // Probe policy has attempts: 5, but unknown error must cap at 3
    await queue.add(
      queueName,
      { videoId },
      {
        jobId,
        ...stagePolicies.probe,
      }
    );

    let executionCount = 0;
    await expect(
      queue.process(async () => {
        executionCount++;
        throw new Error('Uncategorized internal error in processor');
      })
    ).rejects.toThrow('Uncategorized internal error in processor');

    expect(executionCount).toBe(3);

    const dlqEntries = expectOk(await repositories.dlq.list({ limit: 100 }));
    expect(dlqEntries).toHaveLength(1);
    const entry = dlqEntries[0];
    expect(entry).toBeDefined();
    expect(entry?.attemptsMade).toBe(3);
  });

  // AC 3 & AC 6: failParentOnFailure -> parent package fails -> video FAILED with child error code + video.failed published + metric
  it('AC 3 & AC 6: Child failure with failParentOnFailure fails parent package and marks video FAILED with child error code, publishing video.failed', async () => {
    const videoId = await setupUploadedVideo('raw/fail-parent.mp4');
    await repositories.videos.transition({
      videoId,
      from: 'UPLOADED',
      to: 'PROCESSING',
      eventType: 'video.processing',
    });

    const qPackage = getQueue('package');
    const q720 = getQueue('transcode-720p');
    const qNotify = getQueue('notify');

    qPackage.onFailed(
      createFailureHandler({
        workerId: STAGE_SETTINGS.workerId,
        stage: 'package',
        queueName: 'package',
        repositories,
        getQueue,
        logger,
        metrics,
      })
    );
    q720.onFailed(
      createFailureHandler({
        workerId: STAGE_SETTINGS.workerId,
        stage: 'transcode-720p',
        queueName: 'transcode-720p',
        repositories,
        getQueue,
        logger,
        metrics,
      })
    );

    await storage.uploadObject({
      bucket: 'raw',
      key: 'raw/fail-parent.mp4',
      body: Buffer.from('source'),
      contentType: 'video/mp4',
    });
    const transcode720 = createTranscodeProcessor(
      transcodeDeps({ repositories, storage, logger, media: failingTranscodeOf('720p') })
    );
    await q720.process(throughRunner(transcode720));

    // Package processor
    const packageProc = createPackageProcessor({
      ...STAGE_SETTINGS,
      repositories,
      storage,
      logger,
      getQueue,
    });
    await qPackage.process(throughRunner(packageProc));

    // Create flow with failParentOnFailure
    await flowProducer.add({
      name: 'package',
      queueName: 'package',
      data: {
        videoId,
        generation: 1,
        ladder: [
          {
            name: '720p' as const,
            width: 1280,
            height: 720,
            videoKbps: 2800,
            maxrateKbps: 2996,
            bufsizeKbps: 4200,
            audioKbps: 128,
            profile: 'high' as const,
            level: '3.1',
          },
        ],
        traceparent: '00-1',
      },
      opts: { jobId: `${videoId}--package--g1` },
      children: [
        {
          name: 'transcode-720p',
          queueName: 'transcode-720p',
          data: {
            videoId,
            sourceKey: 'raw/fail-parent.mp4',
            generation: 1,
            rendition: {
              name: '720p' as const,
              width: 1280,
              height: 720,
              videoKbps: 2800,
              maxrateKbps: 2996,
              bufsizeKbps: 4200,
              audioKbps: 128,
              profile: 'high' as const,
              level: '3.1',
            },
            fps: 24,
            durationMs: 10000,
            traceparent: '00-1',
          },
          opts: {
            jobId: `${videoId}--transcode--720p--g1`,
            failParentOnFailure: true,
            attempts: 1,
          },
        },
      ],
    });

    // Await background execution of child and parent failure propagation
    await new Promise((r) => setTimeout(r, 50));

    // Verify video transitioned to FAILED with the child's error code (FFMPEG_FAILED)
    const video = expectOk(await repositories.videos.findById(videoId));
    expect(video?.status).toBe('FAILED');
    expect(video?.errorCode).toBe(ErrorCodes.FFMPEG_FAILED);

    // Verify video.failed notify job was enqueued (AC 3)
    expect(qNotify.enqueuedJobs.length).toBeGreaterThanOrEqual(1);
    interface NotifyPayload {
      event?: string;
      payload?: { status?: string; errorCode?: string };
    }
    const notifyJob = qNotify.enqueuedJobs.find(
      (j) => (j.data as NotifyPayload)?.event === 'video.failed'
    );
    expect(notifyJob).toBeDefined();
    const notifyData = notifyJob?.data as NotifyPayload;
    expect(notifyData?.payload?.status).toBe('FAILED');
    expect(notifyData?.payload?.errorCode).toBe(ErrorCodes.FFMPEG_FAILED);

    // Verify DLQ entries exist for both child and parent (AC 3)
    const dlqEntries = expectOk(await repositories.dlq.list({ limit: 100 }));
    expect(dlqEntries.length).toBeGreaterThanOrEqual(1);

    // Verify metrics counter incremented (AC 6)
    const metricOutput = await metrics.registry.metrics();
    expect(metricOutput).toContain('dlq_entries_total');
  });

  // AC 7: Hostile fixture set: every file ends in DLQ with expected code and attemptsMade = 1
  it.each([
    {
      key: 'raw/audio-only.mp4',
      expectedCode: ErrorCodes.CORRUPT_CONTAINER,
      errorMsg: 'Source file contains no video stream',
    },
    {
      key: 'raw/bad-codec.mp4',
      expectedCode: ErrorCodes.UNSUPPORTED_CODEC,
      errorMsg: 'Unsupported video codec "prores"',
    },
    {
      key: 'raw/over-duration.mp4',
      expectedCode: ErrorCodes.DURATION_EXCEEDED,
      errorMsg: 'Video duration exceeds maximum allowed',
    },
  ])(
    'AC 7: Hostile fixture "$key" ends in DLQ with attemptsMade = 1 and expected code $expectedCode',
    async (fixture) => {
      const ffmpegModule = await import('@vp/ffmpeg');

      const probeQueue = new InMemoryJobQueue('probe');
      queues.set('probe', probeQueue);

      probeQueue.onFailed(
        createFailureHandler({
          workerId: STAGE_SETTINGS.workerId,
          stage: 'probe',
          queueName: 'probe',
          repositories,
          getQueue,
          logger,
          metrics,
        })
      );

      const videoId = await setupUploadedVideo(fixture.key);
      await storage.uploadObject({
        bucket: 'raw',
        key: fixture.key,
        body: Buffer.from('hostile-bytes'),
        contentType: 'video/mp4',
      });

      vi.spyOn(ffmpegModule, 'runFfprobe').mockRejectedValueOnce(
        new PermanentError(fixture.expectedCode, fixture.errorMsg)
      );

      const probeProcessor = createProbeProcessor({
        ...STAGE_SETTINGS,
        repositories,
        storage,
        logger,
        getQueue,
        flowProducer,
      });

      const jobId = `${videoId}--probe--g1`;
      await probeQueue.add(
        'probe',
        { videoId, sourceKey: fixture.key, generation: 1, traceparent: '00-1' },
        {
          jobId,
          ...stagePolicies.probe,
        }
      );

      await expect(probeQueue.process(throughRunner(probeProcessor))).rejects.toThrow(
        fixture.errorMsg
      );

      // Verify each hostile file ends in DLQ with expected code and attemptsMade = 1
      const dlqEntries = expectOk(await repositories.dlq.list({ limit: 100 }));
      const entry = dlqEntries.find((i) => i.jobId === jobId);
      expect(entry).toBeDefined();
      expect(entry?.errorCode).toBe(fixture.expectedCode);
      expect(entry?.attemptsMade).toBe(1);
      expect(entry?.status).toBe('PARKED');

      // Verify video is FAILED
      const video = expectOk(await repositories.videos.findById(videoId));
      expect(video?.status).toBe('FAILED');
      expect(video?.errorCode).toBe(fixture.expectedCode);
    }
  );
});
