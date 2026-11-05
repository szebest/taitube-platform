import { inProcessAppConfig } from '@vp/env-schema';
import { ErrorCodes, TransientError } from '@vp/errors';
import type { Fmp4Fragment, LiveOptions, MediaTools } from '@vp/ffmpeg';
import type { LiveJob } from '@vp/job-contracts';
import { expectErr, expectOk } from '@vp/testing/result';
import { STAGE_SETTINGS } from '../../../__tests__/stage-settings';
import { createLiveStage } from '../live-stage';
import { LiveUploader } from '../live-uploader';
import { BUCKET, liveWorld, OWNER_ID, STREAM_ID, STREAM_KEY, VIDEO_ID } from './live-world';

const PATH = `live/${STREAM_KEY}`;
const NEXT_VIDEO_ID = '00000000-0000-7000-8000-00000000f2ff';
const FRAGMENTS: Fmp4Fragment[] = [
  { type: 'init', bytes: Uint8Array.of(0) },
  ...Array.from(
    { length: 8 },
    (_, n): Fmp4Fragment => ({ type: 'media', bytes: Uint8Array.of(n) })
  ),
];

type Broadcast = (
  options: LiveOptions,
  world: Awaited<ReturnType<typeof liveWorld>>
) => Promise<void>;

/** Sends the fragments, then the publisher leaves: a whole broadcast. */
const wholeBroadcast: Broadcast = async (options, world) => {
  for (const fragment of FRAGMENTS) options.onFragment(fragment);
  await world.gateway.kick(PATH);
};

async function run(
  options: {
    broadcast?: Broadcast;
    publishing?: boolean;
    attemptsMade?: number;
    liveStreamId?: string;
  } = {}
) {
  const world = await liveWorld();
  if (options.publishing ?? true) world.gateway.publish(PATH);
  let clock = 0;
  const live = vi.fn((liveOptions: LiveOptions) =>
    (options.broadcast ?? wholeBroadcast)(liveOptions, world)
  );
  const media: MediaTools = { ...STAGE_SETTINGS.media, live };
  const config = inProcessAppConfig();
  const stage = createLiveStage({
    config: { ...config, live: { ...config.live, hookSecret: 'hook-secret' } },
    repositories: world.repositories,
    storage: world.storage,
    liveGateway: world.gateway,
    media,
    logger: world.logger,
    now: () => clock,
    newUploader: () => new LiveUploader(world.storage, BUCKET),
    wait: async (ms) => {
      clock += ms;
    },
  });
  const data: LiveJob = { liveStreamId: options.liveStreamId ?? STREAM_ID, videoId: VIDEO_ID };
  const outcome = await stage({
    id: `${STREAM_ID}--live`,
    name: 'live',
    data,
    attemptsMade: options.attemptsMade ?? 0,
    opts: { attempts: 5 },
  });
  const stream = expectOk(await world.repositories.liveStreams.findById(STREAM_ID));
  const video = expectOk(await world.repositories.videos.findById(VIDEO_ID));
  return { ...world, live, outcome, stream, video };
}

const failing: Broadcast = async () => {
  throw new TransientError(ErrorCodes.FFMPEG_FAILED, 'ingest dropped');
};

describe('worker/live: createLiveStage', () => {
  it('packages a broadcast until the publisher leaves, then archives it', async () => {
    const { outcome, stream, video, storage } = await run();

    expectOk(outcome);
    expect(stream?.status).toBe('ENDED');
    expect(video).toMatchObject({ status: 'READY', durationMs: 4000 });
    expect(expectOk(await storage.headObject(BUCKET, `live/${STREAM_ID}/0/1.m4s`))).not.toBeNull();
  });

  it.each([
    { scenario: 'drops a publisher that reconnected just before the end', nextLive: false },
    { scenario: 'keeps one that already went live on the next stream', nextLive: true },
  ])('$scenario', async ({ nextLive }) => {
    const reconnecting: Broadcast = async (options, world) => {
      await wholeBroadcast(options, world);
      const { liveStreams } = world.repositories;
      const end = liveStreams.end.bind(liveStreams);
      vi.spyOn(liveStreams, 'end').mockImplementation(async (input) => {
        world.gateway.publish(PATH);
        const ended = await end(input);
        if (nextLive) {
          await liveStreams.goLive({
            streamId: input.nextId,
            video: { id: NEXT_VIDEO_ID, ownerId: OWNER_ID, sourceKey: `live/${input.nextId}/` },
            startedAt: new Date(),
            outbox: [],
          });
        }
        return ended;
      });
    };

    const { outcome, stream, gateway } = await run({ broadcast: reconnecting });

    expectOk(outcome);
    expect(stream?.status).toBe('ENDED');
    expect(expectOk(await gateway.isPublishing(PATH))).toBe(nextLive);
  });

  it('reads the ingest as the worker, with the hook secret', async () => {
    const { live } = await run();

    expect(live.mock.calls[0]?.[0].inputUrl).toBe(
      `rtsp://vp-worker:hook-secret@localhost:8554/live/${STREAM_KEY}`
    );
  });

  it('fails for a retry when nobody publishes within the wait', async () => {
    const { outcome, stream, live } = await run({ publishing: false });

    expect(expectErr(outcome).code).toBe(ErrorCodes.LIVE_INGEST_UNAVAILABLE);
    expect(stream?.status).toBe('LIVE');
    expect(live).not.toHaveBeenCalled();
  });

  it('fails for a retry when the ingest drops while the publisher still sends', async () => {
    const { outcome, stream } = await run({ broadcast: failing });

    expect(expectErr(outcome).code).toBe(ErrorCodes.FFMPEG_FAILED);
    expect(stream?.status).toBe('LIVE');
  });

  it('ends the broadcast on its last attempt rather than leave it live', async () => {
    const { outcome, stream, gateway } = await run({ broadcast: failing, attemptsMade: 4 });

    expect(expectErr(outcome).code).toBe(ErrorCodes.FFMPEG_FAILED);
    expect(stream?.status).toBe('ENDED');
    expect(gateway.kicked).toEqual([PATH]);
  });

  it('archives a broadcast whose ingest failed once the publisher has gone', async () => {
    const dropped: Broadcast = async (options, world) => {
      await wholeBroadcast(options, world);
      throw new TransientError(ErrorCodes.FFMPEG_FAILED, 'ingest dropped');
    };

    const { outcome, video } = await run({ broadcast: dropped });

    expectOk(outcome);
    expect(video?.status).toBe('READY');
  });

  it('refuses a stream that does not exist', async () => {
    const { outcome } = await run({ liveStreamId: '00000000-0000-7000-8000-00000000f1ff' });

    expect(expectErr(outcome).code).toBe(ErrorCodes.LIVE_STREAM_NOT_FOUND);
  });
});
