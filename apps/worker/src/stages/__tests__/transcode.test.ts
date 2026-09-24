import { InMemoryRepositories, InMemoryStorageClient } from '@vp/adapters/in-memory';
import type { QueueJob } from '@vp/core/ports';
import { ErrorCodes, databaseUnavailable } from '@vp/errors';
import type { MediaTools } from '@vp/ffmpeg';
import type { TranscodeJob } from '@vp/job-contracts';
import { createLogger } from '@vp/observability';
import { err, ok } from '@vp/result';
import { expectOk } from '@vp/testing/result';
import { uuidv7 } from 'uuidv7';
import { STAGE_SETTINGS, transcodeDeps } from '../../__tests__/stage-settings';
import { createTranscodeProcessor } from '../transcode';

const logger = createLogger({ service: 'transcode-spec', level: 'silent' });

/** FFmpeg that reports progress once, then runs until it is aborted, the way a long encode does. */
function encodeUntilAborted(): { media: MediaTools; aborted: () => boolean } {
  let signal: AbortSignal | undefined;
  return {
    aborted: () => signal?.aborted === true,
    media: {
      ...STAGE_SETTINGS.media,
      transcode: (options) => {
        signal = options.signal;
        options.onProgress?.({ percent: 10, outTimeMs: 6_000 });
        return new Promise((_, reject) => {
          options.signal?.addEventListener('abort', () => reject(new Error('killed')));
        });
      },
    },
  };
}

describe('apps/worker/stages: transcode', () => {
  let repositories: InMemoryRepositories;
  let storage: InMemoryStorageClient;
  let videoId: string;

  const job = (): QueueJob<TranscodeJob> => ({
    id: `${videoId}--transcode--720p--g1`,
    name: 'transcode-720p',
    data: {
      videoId,
      sourceKey: 'raw/source.mp4',
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
      durationMs: 60_000,
      traceparent: '00-01',
    },
  });

  beforeEach(async () => {
    repositories = new InMemoryRepositories();
    storage = new InMemoryStorageClient();
    videoId = uuidv7();
    expectOk(
      await repositories.videos.create({
        id: videoId,
        ownerId: uuidv7(),
        sourceKey: 'raw/source.mp4',
        status: 'PROCESSING',
      })
    );
    expectOk(
      await repositories.renditions.create({
        id: uuidv7(),
        videoId,
        name: '720p',
        width: 1280,
        height: 720,
        videoBitrateKbps: 2800,
        audioBitrateKbps: 128,
        status: 'PENDING',
      })
    );
    expectOk(
      await storage.uploadObject({
        bucket: 'raw',
        key: 'raw/source.mp4',
        body: 'source bytes',
        contentType: 'video/mp4',
      })
    );
  });

  it.each([
    {
      lease: 'a renewal the database refused',
      renewal: err(databaseUnavailable('heartbeat')),
      outcome: err(expect.objectContaining({ code: ErrorCodes.DATABASE_UNAVAILABLE })),
    },
    {
      lease: 'a step another worker has claimed',
      renewal: ok(false),
      outcome: ok(expect.objectContaining({ playlistKey: '', segmentCount: 0 })),
    },
  ])('aborts FFmpeg and commits nothing on $lease', async ({ renewal, outcome }) => {
    vi.spyOn(repositories.steps, 'heartbeat').mockResolvedValue(renewal);
    const complete = vi.spyOn(repositories.steps, 'complete');
    const { media, aborted } = encodeUntilAborted();

    const transcode = createTranscodeProcessor(
      transcodeDeps({ repositories, storage, logger, media })
    );

    expect(await transcode(job())).toEqual(outcome);
    expect(aborted()).toBe(true);
    expect(complete).not.toHaveBeenCalled();
    const [rendition] = expectOk(await repositories.renditions.findByVideoId(videoId));
    expect(rendition?.status).toBe('RUNNING');
    const events = expectOk(await repositories.events.findByVideoId(videoId));
    expect(events.map((event) => event.type)).not.toContain('transcode.completed');
  });

  it('waits for a renewal still in flight when FFmpeg finishes, and commits nothing if it failed', async () => {
    let refuse: () => void = () => {};
    let requested: () => void = () => {};
    const renewalRequested = new Promise<void>((resolve) => {
      requested = resolve;
    });
    vi.spyOn(repositories.steps, 'heartbeat').mockImplementation(() => {
      requested();
      return new Promise((resolve) => {
        refuse = () => resolve(err(databaseUnavailable('heartbeat')));
      });
    });
    const complete = vi.spyOn(repositories.steps, 'complete');
    const media: MediaTools = {
      ...STAGE_SETTINGS.media,
      transcode: async (options) => {
        options.onProgress?.({ percent: 100, outTimeMs: 60_000 });
        return { outputDir: options.outputDir, playlistPath: '', segmentCount: 0, durationMs: 0 };
      },
    };

    const transcoding = createTranscodeProcessor(
      transcodeDeps({ repositories, storage, logger, media })
    )(job());
    await renewalRequested;
    refuse();

    expect(await transcoding).toEqual(
      err(expect.objectContaining({ code: ErrorCodes.DATABASE_UNAVAILABLE }))
    );
    expect(complete).not.toHaveBeenCalled();
  });
});
