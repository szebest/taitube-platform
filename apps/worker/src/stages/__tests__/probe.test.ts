import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { InMemoryRepositories, InMemoryStorageClient } from '@vp/adapters/in-memory';
import type { QueueJob } from '@vp/core/ports';
import { type ErrorCode, ErrorCodes, PermanentError } from '@vp/errors';
import type { MediaTools, ProbeMetadata } from '@vp/ffmpeg';
import type { ProbeJob } from '@vp/job-contracts';
import { createLogger } from '@vp/logger';
import { SEEDED } from '@vp/testing';
import { expectErr, expectOk } from '@vp/testing/result';
import { uuidv7 } from 'uuidv7';
import { rungs } from '../../__tests__/flow-harness';
import { STAGE_SETTINGS } from '../../__tests__/stage-settings';
import { createProbeProcessor } from '../probe';

const OWNER_ID = SEEDED.userId;
const logger = createLogger({ format: 'json', service: 'worker-probe-test', level: 'silent' });

function metadata(overrides: Partial<ProbeMetadata>): ProbeMetadata {
  return {
    durationMs: 60_000,
    width: 1920,
    height: 1080,
    effectiveWidth: 1920,
    effectiveHeight: 1080,
    rotation: 0,
    fps: 24,
    videoCodec: 'h264',
    bitrateKbps: 5000,
    ladder: rungs('1080p', '720p', '480p'),
    ...overrides,
  };
}

describe('probe stage', () => {
  let repositories: InMemoryRepositories;
  let storage: InMemoryStorageClient;

  beforeEach(() => {
    repositories = new InMemoryRepositories();
    storage = new InMemoryStorageClient();
  });

  async function uploadedVideo(sourceKey: string, body?: Buffer): Promise<string> {
    const videoId = uuidv7();
    await repositories.videos.create({
      id: videoId,
      ownerId: OWNER_ID,
      title: sourceKey,
      status: 'UPLOADED',
      sourceKey,
      sourceSizeBytes: 1000,
    });
    if (body) {
      await storage.uploadObject({ bucket: 'raw', key: sourceKey, body, contentType: 'video/mp4' });
    }
    return videoId;
  }

  function probeJob(videoId: string, sourceKey: string): QueueJob<ProbeJob> {
    return {
      id: `${videoId}--probe--g1`,
      name: 'probe',
      data: { videoId, sourceKey, generation: 1, traceparent: '00-01-01-01' },
      attemptsMade: 0,
      updateProgress: vi.fn().mockResolvedValue(undefined),
    };
  }

  function processorProbing(probe: MediaTools['probe']) {
    const media: MediaTools = { ...STAGE_SETTINGS.media, probe };
    return createProbeProcessor({ ...STAGE_SETTINGS, media, repositories, storage, logger });
  }

  it('fails the video with SOURCE_MISSING when the source object is gone', async () => {
    const videoId = await uploadedVideo('raw/non-existent.mp4');
    const processor = createProbeProcessor({ ...STAGE_SETTINGS, repositories, storage, logger });

    const failure = expectErr(await processor(probeJob(videoId, 'raw/non-existent.mp4')));

    expect(failure.code).toBe(ErrorCodes.SOURCE_MISSING);
    const video = expectOk(await repositories.videos.findById(videoId));
    expect(video?.status).toBe('FAILED');
    expect(video?.errorCode).toBe(ErrorCodes.SOURCE_MISSING);
  });

  it('fences a step completion made with a lock token a later claim replaced', async () => {
    const videoId = await uploadedVideo('raw/fencing-test.mp4');
    const claim = (attempt: number, workerId: string, lockToken: string) =>
      repositories.steps.claim({
        id: uuidv7(),
        videoId,
        step: 'probe',
        rendition: '-',
        jobId: `${videoId}--probe--g1`,
        attempt,
        workerId,
        lockToken,
      });
    const complete = (lockToken: string) =>
      repositories.steps.complete({ videoId, step: 'probe', rendition: '-', lockToken });
    const staleToken = uuidv7();
    const currentToken = uuidv7();

    expect(expectOk(await claim(1, 'worker-1', staleToken))).toMatchObject({
      fenced: false,
      lockToken: staleToken,
    });
    expect(expectOk(await claim(2, 'worker-2', currentToken))).toMatchObject({
      fenced: false,
      lockToken: currentToken,
    });
    expect(expectOk(await complete(staleToken))).toMatchObject({ fenced: true, completed: false });
    expect(expectOk(await complete(currentToken))).toMatchObject({
      fenced: false,
      completed: true,
    });
  });

  it('rejects a real source longer than the configured maximum with DURATION_EXCEEDED', async () => {
    const fixture = path.resolve(__dirname, '../../../../../tests/fixtures/s15.mp4');
    const videoId = await uploadedVideo('raw/s15.mp4', await fs.readFile(fixture));
    const processor = createProbeProcessor({
      ...STAGE_SETTINGS,
      maxDurationSeconds: 10,
      repositories,
      storage,
      logger,
    });

    expect(expectErr(await processor(probeJob(videoId, 'raw/s15.mp4'))).code).toBe(
      ErrorCodes.DURATION_EXCEEDED
    );
    expect(expectOk(await repositories.videos.findById(videoId))?.errorCode).toBe(
      ErrorCodes.DURATION_EXCEEDED
    );
  });

  it.each<{ source: string; body: Buffer; code: ErrorCode; message: string }>([
    {
      source: 'zero-bytes',
      body: Buffer.alloc(0),
      code: ErrorCodes.CORRUPT_CONTAINER,
      message: 'Zero bytes media',
    },
    {
      source: 'audio-only',
      body: Buffer.from('audio-only'),
      code: ErrorCodes.CORRUPT_CONTAINER,
      message: 'Source file contains no video stream',
    },
    {
      source: 'bad-codec',
      body: Buffer.from('bad-codec'),
      code: ErrorCodes.UNSUPPORTED_CODEC,
      message: 'Unsupported video codec "prores"',
    },
    {
      source: 'over-duration',
      body: Buffer.from('over-duration'),
      code: ErrorCodes.DURATION_EXCEEDED,
      message: 'Video duration exceeds maximum allowed',
    },
  ])('fails a hostile $source source on the first attempt with $code', async (hostile) => {
    const sourceKey = `raw/${hostile.source}.mp4`;
    const videoId = await uploadedVideo(sourceKey, hostile.body);
    const processor = processorProbing(() =>
      Promise.reject(new PermanentError(hostile.code, hostile.message))
    );

    expect(expectErr(await processor(probeJob(videoId, sourceKey))).code).toBe(hostile.code);
    const video = expectOk(await repositories.videos.findById(videoId));
    expect(video?.status).toBe('FAILED');
    expect(video?.errorCode).toBe(hostile.code);
  });

  it('moves a good source to PROCESSING with pending renditions, probe events and no temp dir left', async () => {
    const videoId = await uploadedVideo('raw/s60.mp4', Buffer.from('mock-media-content'));
    const processor = processorProbing(() =>
      Promise.resolve(metadata({ audioCodec: 'aac', bitrateKbps: 5000 }))
    );

    const result = expectOk(await processor(probeJob(videoId, 'raw/s60.mp4')));

    expect(result).toMatchObject({ status: 'PROCESSING', durationMs: 60_000 });
    expect(expectOk(await repositories.videos.findById(videoId))).toMatchObject({
      status: 'PROCESSING',
      durationMs: 60_000,
      width: 1920,
      height: 1080,
    });
    const renditions = expectOk(await repositories.renditions.findByVideoId(videoId));
    expect(renditions.map((r) => r.name).sort()).toEqual(['1080p', '480p', '720p']);
    expect(renditions.every((r) => r.status === 'PENDING')).toBe(true);
    const eventTypes = expectOk(await repositories.events.findByVideoId(videoId)).map(
      (e) => e.type
    );
    expect(eventTypes).toEqual(expect.arrayContaining(['probe.started', 'probe.completed']));
    const tmpEntries = await fs.readdir(os.tmpdir());
    expect(tmpEntries.filter((entry) => entry.includes(`vp-probe-${videoId}`))).toEqual([]);
  });

  it.each([
    {
      source: 'p720',
      probed: metadata({
        durationMs: 30_000,
        width: 1280,
        height: 720,
        effectiveWidth: 1280,
        effectiveHeight: 720,
        bitrateKbps: 2800,
        ladder: rungs('720p', '480p'),
      }),
      renditions: ['480p', '720p'],
      width: 1280,
      height: 720,
    },
    {
      source: 'sd360',
      probed: metadata({
        durationMs: 15_000,
        width: 640,
        height: 360,
        effectiveWidth: 640,
        effectiveHeight: 360,
        bitrateKbps: 1400,
        ladder: rungs('480p'),
      }),
      renditions: ['480p'],
      width: 640,
      height: 360,
    },
    {
      source: 'portrait',
      probed: metadata({
        durationMs: 10_000,
        effectiveWidth: 1080,
        effectiveHeight: 1920,
        rotation: 90,
        ladder: rungs('1080p', '720p', '480p'),
      }),
      renditions: ['1080p', '480p', '720p'],
      width: 1080,
      height: 1920,
    },
  ])('stores the $source ladder and its rotation-aware dimensions', async (probeCase) => {
    const sourceKey = `raw/${probeCase.source}.mp4`;
    const videoId = await uploadedVideo(sourceKey, Buffer.from(`mock-${probeCase.source}`));
    const processor = processorProbing(() => Promise.resolve(probeCase.probed));

    expectOk(await processor(probeJob(videoId, sourceKey)));

    const renditions = expectOk(await repositories.renditions.findByVideoId(videoId));
    expect(renditions.map((r) => r.name).sort()).toEqual(probeCase.renditions);
    expect(expectOk(await repositories.videos.findById(videoId))).toMatchObject({
      width: probeCase.width,
      height: probeCase.height,
    });
  });
});
