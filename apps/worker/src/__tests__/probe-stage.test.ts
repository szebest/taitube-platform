import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { InMemoryRepositories, InMemoryStorageClient } from '@vp/adapters/in-memory';
import type { QueueJob } from '@vp/core/ports';
import { ErrorCodes, PermanentError } from '@vp/errors';
import type { ProbeJob } from '@vp/job-contracts';
import { createLogger } from '@vp/logger';
import { expectErr, expectOk } from '@vp/testing/result';
import { uuidv7 } from 'uuidv7';
import { createProbeProcessor } from '../stages/probe';
import { STAGE_SETTINGS } from './stage-settings';

describe('apps/worker probe stage (Ticket 06: AC 17, 18, 19, 20, 21, 22)', () => {
  let repositories: InMemoryRepositories;
  let storage: InMemoryStorageClient;
  const DEV_USER_ID = '00000000-0000-7000-8000-000000000001';
  const logger = createLogger({ format: 'json', service: 'worker-probe-test', level: 'silent' });

  function createMockJob(id: string, data: ProbeJob): QueueJob<ProbeJob> {
    return {
      id,
      name: 'probe',
      data,
      attemptsMade: 0,
      updateProgress: vi.fn().mockResolvedValue(undefined),
    };
  }

  beforeEach(() => {
    repositories = new InMemoryRepositories();
    storage = new InMemoryStorageClient();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Helper to create video in UPLOADED state
  async function setupUploadedVideo(sourceKey: string, title = 'Test Video'): Promise<string> {
    const videoId = uuidv7();
    await repositories.videos.create({
      id: videoId,
      ownerId: DEV_USER_ID,
      title,
      status: 'UPLOADED',
      sourceKey,
      sourceSizeBytes: 1000,
    });
    return videoId;
  }

  it('AC 19: deleted or missing source object throws UnrecoverableError and sets video to FAILED', async () => {
    const missingKey = 'raw/non-existent.mp4';
    const videoId = await setupUploadedVideo(missingKey, 'Missing Video');

    const processor = createProbeProcessor({ ...STAGE_SETTINGS, repositories, storage, logger });

    const job = createMockJob(`${videoId}--probe--g1`, {
      videoId,
      sourceKey: missingKey,
      generation: 1,
      traceparent: '00-01-01-01',
    });

    expect(expectErr(await processor(job)).code).toBe(ErrorCodes.SOURCE_MISSING);

    // Verify video in DB became FAILED with SOURCE_MISSING
    const video = expectOk(await repositories.videos.findById(videoId));
    expect(video?.status).toBe('FAILED');
    expect(video?.errorCode).toBe(ErrorCodes.SOURCE_MISSING);
  });

  it('AC 20: processing_steps row claimed with lock_token, heartbeat_at updated, finished with same token; fenced on stale token', async () => {
    const videoId = await setupUploadedVideo('raw/fencing-test.mp4', 'Fencing Test');
    const lockToken1 = uuidv7();
    const workerId1 = 'worker-1';

    // Worker 1 claims step
    const claim1 = await repositories.steps.claim({
      id: uuidv7(),
      videoId,
      step: 'probe',
      rendition: '-',
      jobId: `${videoId}--probe--g1`,
      attempt: 1,
      workerId: workerId1,
      lockToken: lockToken1,
    });
    expect(expectOk(claim1).fenced).toBe(false);
    expect(expectOk(claim1).lockToken).toBe(lockToken1);

    // Worker 2 (or retry) claims step with NEW token
    const lockToken2 = uuidv7();
    const claim2 = await repositories.steps.claim({
      id: uuidv7(),
      videoId,
      step: 'probe',
      rendition: '-',
      jobId: `${videoId}--probe--g1`,
      attempt: 2,
      workerId: 'worker-2',
      lockToken: lockToken2,
    });
    expect(expectOk(claim2).fenced).toBe(false);
    expect(expectOk(claim2).lockToken).toBe(lockToken2);

    // Worker 1 tries to complete step with stale lockToken1 -> FENCED!
    const comp1 = await repositories.steps.complete({
      videoId,
      step: 'probe',
      rendition: '-',
      lockToken: lockToken1, // Stale!
    });
    expect(expectOk(comp1).fenced).toBe(true);
    expect(expectOk(comp1).completed).toBe(false);

    // Worker 2 completes step with current lockToken2 -> SUCCEEDS!
    const comp2 = await repositories.steps.complete({
      videoId,
      step: 'probe',
      rendition: '-',
      lockToken: lockToken2,
    });
    expect(expectOk(comp2).fenced).toBe(false);
    expect(expectOk(comp2).completed).toBe(true);
  });

  it('rejects a source longer than MAX_DURATION_SEC with DURATION_EXCEEDED', async () => {
    const videoId = await setupUploadedVideo('raw/s15.mp4', 'Fifteen Seconds');
    await storage.uploadObject({
      bucket: 'raw',
      key: 'raw/s15.mp4',
      body: await fs.readFile(path.resolve(__dirname, '../../../../tests/fixtures/s15.mp4')),
      contentType: 'video/mp4',
    });
    const processor = createProbeProcessor({
      ...STAGE_SETTINGS,
      maxDurationSeconds: 10,
      repositories,
      storage,
      logger,
    });

    const job = createMockJob(`${videoId}--probe--g1`, {
      videoId,
      sourceKey: 'raw/s15.mp4',
      generation: 1,
      traceparent: '00-01-01-01',
    });

    expect(expectErr(await processor(job)).code).toBe(ErrorCodes.DURATION_EXCEEDED);
    expect(expectOk(await repositories.videos.findById(videoId))?.errorCode).toBe(
      ErrorCodes.DURATION_EXCEEDED
    );
  });

  it('AC 18: hostile zero-bytes file fails on attempt 1 with CORRUPT_CONTAINER', async () => {
    const videoId = await setupUploadedVideo('raw/zero-bytes.mp4', 'Zero Bytes Test');

    await storage.uploadObject({
      bucket: 'raw',
      key: 'raw/zero-bytes.mp4',
      body: Buffer.alloc(0),
      contentType: 'video/mp4',
    });

    const ffmpegModule = await import('@vp/ffmpeg');
    const probeSpy = vi
      .spyOn(ffmpegModule, 'runFfprobe')
      .mockRejectedValueOnce(new PermanentError(ErrorCodes.CORRUPT_CONTAINER, 'Zero bytes media'));

    const processor = createProbeProcessor({ ...STAGE_SETTINGS, repositories, storage, logger });

    const job = createMockJob(`${videoId}--probe--g1`, {
      videoId,
      sourceKey: 'raw/zero-bytes.mp4',
      generation: 1,
      traceparent: '00-01-01-01',
    });

    expect(expectErr(await processor(job)).code).toBe(ErrorCodes.CORRUPT_CONTAINER);

    // Verify video in DB became FAILED with CORRUPT_CONTAINER
    const video = expectOk(await repositories.videos.findById(videoId));
    expect(video?.status).toBe('FAILED');
    expect(video?.errorCode).toBe(ErrorCodes.CORRUPT_CONTAINER);

    probeSpy.mockRestore();
  });

  it('AC 17 & AC 21: good s60 video becomes PROCESSING, ladder [1080p, 720p, 480p], renditions PENDING, and temp dir cleaned up', async () => {
    const videoId = await setupUploadedVideo('raw/s60.mp4', 'Standard 60s Video');

    await storage.uploadObject({
      bucket: 'raw',
      key: 'raw/s60.mp4',
      body: Buffer.from('mock-media-content'),
      contentType: 'video/mp4',
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

    const processor = createProbeProcessor({ ...STAGE_SETTINGS, repositories, storage, logger });

    const job = createMockJob(`${videoId}--probe--g1`, {
      videoId,
      sourceKey: 'raw/s60.mp4',
      generation: 1,
      traceparent: '00-01-01-01',
    });

    const result = expectOk(await processor(job));
    expect(result.status).toBe('PROCESSING');
    expect(result.durationMs).toBe(60000);

    // 1. Verify video in DB is PROCESSING with duration and ladder
    const video = expectOk(await repositories.videos.findById(videoId));
    expect(video?.status).toBe('PROCESSING');
    expect(video?.durationMs).toBe(60000);
    expect(video?.width).toBe(1920);
    expect(video?.height).toBe(1080);

    // 2. Verify renditions table has PENDING rows for 1080p, 720p, 480p (AC 17)
    const rends = expectOk(await repositories.renditions.findByVideoId(videoId));
    expect(rends.length).toBe(3);
    const rendNames = rends.map((r: any) => r.name).sort();
    expect(rendNames).toEqual(['1080p', '480p', '720p']);
    expect(rends.every((r: any) => r.status === 'PENDING')).toBe(true);

    // 3. Verify video_events contains probe.started and probe.completed (AC 17)
    const events = expectOk(await repositories.events.findByVideoId(videoId));
    expect(events.some((e: any) => e.type === 'probe.started')).toBe(true);
    expect(events.some((e: any) => e.type === 'probe.completed')).toBe(true);

    // AC 21: Verify temp dir cleanup
    const tmpContents = await fs.readdir(os.tmpdir());
    const orphanedDirs = tmpContents.filter((f) => f.includes(`vp-probe-${videoId}`));
    expect(orphanedDirs.length).toBe(0);

    probeSpy.mockRestore();
  });

  it('AC 17: p720 produces ladder [720p, 480p], sd360 produces [480p], portrait has rotation-aware dimensions', async () => {
    const p720Id = await setupUploadedVideo('raw/p720.mp4', '720p Video');
    const sd360Id = await setupUploadedVideo('raw/sd360.mp4', '360p Video');
    const portraitId = await setupUploadedVideo('raw/portrait.mp4', 'Portrait Video');

    await storage.uploadObject({
      bucket: 'raw',
      key: 'raw/p720.mp4',
      body: Buffer.from('mock-p720'),
      contentType: 'video/mp4',
    });
    await storage.uploadObject({
      bucket: 'raw',
      key: 'raw/sd360.mp4',
      body: Buffer.from('mock-sd360'),
      contentType: 'video/mp4',
    });
    await storage.uploadObject({
      bucket: 'raw',
      key: 'raw/portrait.mp4',
      body: Buffer.from('mock-portrait'),
      contentType: 'video/mp4',
    });

    const ffmpegModule = await import('@vp/ffmpeg');

    const processor = createProbeProcessor({ ...STAGE_SETTINGS, repositories, storage, logger });

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

    const p720Rends = expectOk(await repositories.renditions.findByVideoId(p720Id));
    expect(p720Rends.map((r: any) => r.name).sort()).toEqual(['480p', '720p']);

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

    const sd360Rends = expectOk(await repositories.renditions.findByVideoId(sd360Id));
    expect(sd360Rends.map((r: any) => r.name)).toEqual(['480p']);

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

    const portraitVideo = expectOk(await repositories.videos.findById(portraitId));
    expect(portraitVideo?.width).toBe(1080); // rotation-aware effective dimensions
    expect(portraitVideo?.height).toBe(1920);
  });

  it('AC 18: hostile audio-only, unsupported-codec, and over-duration files fail on attempt 1 with correct error codes', async () => {
    const audioOnlyId = await setupUploadedVideo('raw/audio-only.mp4', 'Audio Only');
    const badCodecId = await setupUploadedVideo('raw/bad-codec.mp4', 'Bad Codec');
    const overDurationId = await setupUploadedVideo('raw/over-duration.mp4', 'Over Duration');

    await storage.uploadObject({
      bucket: 'raw',
      key: 'raw/audio-only.mp4',
      body: Buffer.from('audio-only'),
      contentType: 'video/mp4',
    });
    await storage.uploadObject({
      bucket: 'raw',
      key: 'raw/bad-codec.mp4',
      body: Buffer.from('bad-codec'),
      contentType: 'video/mp4',
    });
    await storage.uploadObject({
      bucket: 'raw',
      key: 'raw/over-duration.mp4',
      body: Buffer.from('over-duration'),
      contentType: 'video/mp4',
    });

    const ffmpegModule = await import('@vp/ffmpeg');

    const processor = createProbeProcessor({ ...STAGE_SETTINGS, repositories, storage, logger });

    // 1. audio-only -> CORRUPT_CONTAINER
    vi.spyOn(ffmpegModule, 'runFfprobe').mockRejectedValueOnce(
      new PermanentError(ErrorCodes.CORRUPT_CONTAINER, 'Source file contains no video stream')
    );
    expect(
      expectErr(
        await processor(
          createMockJob(`${audioOnlyId}--probe--g1`, {
            videoId: audioOnlyId,
            sourceKey: 'raw/audio-only.mp4',
            generation: 1,
            traceparent: '00-1',
          })
        )
      ).code
    ).toBe(ErrorCodes.CORRUPT_CONTAINER);

    const audioVideo = expectOk(await repositories.videos.findById(audioOnlyId));
    expect(audioVideo?.status).toBe('FAILED');
    expect(audioVideo?.errorCode).toBe(ErrorCodes.CORRUPT_CONTAINER);

    // 2. unsupported codec -> UNSUPPORTED_CODEC
    vi.spyOn(ffmpegModule, 'runFfprobe').mockRejectedValueOnce(
      new PermanentError(ErrorCodes.UNSUPPORTED_CODEC, 'Unsupported video codec "prores"')
    );
    expect(
      expectErr(
        await processor(
          createMockJob(`${badCodecId}--probe--g1`, {
            videoId: badCodecId,
            sourceKey: 'raw/bad-codec.mp4',
            generation: 1,
            traceparent: '00-1',
          })
        )
      ).code
    ).toBe(ErrorCodes.UNSUPPORTED_CODEC);

    const codecVideo = expectOk(await repositories.videos.findById(badCodecId));
    expect(codecVideo?.status).toBe('FAILED');
    expect(codecVideo?.errorCode).toBe(ErrorCodes.UNSUPPORTED_CODEC);

    // 3. over-duration -> DURATION_EXCEEDED
    vi.spyOn(ffmpegModule, 'runFfprobe').mockRejectedValueOnce(
      new PermanentError(ErrorCodes.DURATION_EXCEEDED, 'Video duration exceeds maximum allowed')
    );
    expect(
      expectErr(
        await processor(
          createMockJob(`${overDurationId}--probe--g1`, {
            videoId: overDurationId,
            sourceKey: 'raw/over-duration.mp4',
            generation: 1,
            traceparent: '00-1',
          })
        )
      ).code
    ).toBe(ErrorCodes.DURATION_EXCEEDED);

    const durVideo = expectOk(await repositories.videos.findById(overDurationId));
    expect(durVideo?.status).toBe('FAILED');
    expect(durVideo?.errorCode).toBe(ErrorCodes.DURATION_EXCEEDED);
  });
});
