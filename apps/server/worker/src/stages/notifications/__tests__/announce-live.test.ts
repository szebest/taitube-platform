import { InMemoryJobQueue, InMemoryRepositories } from '@vp/adapters/in-memory';
import type { QueueJob } from '@vp/core/ports';
import type { AnnounceLiveJob } from '@vp/job-contracts';
import { expectOk } from '@vp/testing/result';
import { createAnnounceLiveProcessor } from '../announce-live';
import {
  CHANNEL_ID,
  CREATOR_ID,
  logger,
  seedCreator,
  seedSubscriber,
  userId,
} from './notification-harness';

const STREAM_ID = '00000000-0000-7000-8000-00000000f101';
const VIDEO_ID = '00000000-0000-7000-8000-00000000f201';
const STARTED = new Date('2026-03-01T12:00:00.000Z');

describe('apps/server/worker/stages: announce-live', () => {
  let repositories: InMemoryRepositories;
  let queue: InMemoryJobQueue;

  const announce = async (
    data: AnnounceLiveJob = { liveStreamId: STREAM_ID },
    batchSize?: number
  ) => {
    const job: QueueJob<AnnounceLiveJob> = {
      id: `${STREAM_ID}--announce-live`,
      name: 'announce-live',
      data,
    };
    return expectOk(
      await createAnnounceLiveProcessor({ repositories, getQueue: () => queue, logger, batchSize })(
        job
      )
    );
  };

  const eventsOf = async (n: number) =>
    expectOk(await repositories.userEvents.listFrom(userId(n), 0, 10)).map(({ type, payload }) => ({
      type,
      payload,
    }));

  async function goLive(visibility: 'public' | 'unlisted' = 'public') {
    expectOk(
      await repositories.liveStreams.ensureIdle(CHANNEL_ID, {
        id: STREAM_ID,
        streamKey: 'key',
        overlayToken: 'overlay',
        controlToken: 'control',
      })
    );
    expectOk(await repositories.liveStreams.update(STREAM_ID, { title: 'Speedrun', visibility }));
    expectOk(
      await repositories.liveStreams.goLive({
        streamId: STREAM_ID,
        video: { id: VIDEO_ID, ownerId: CREATOR_ID, visibility, sourceKey: `live/${STREAM_ID}/` },
        startedAt: STARTED,
        outbox: [],
      })
    );
  }

  beforeEach(async () => {
    repositories = new InMemoryRepositories();
    queue = new InMemoryJobQueue('notify');
    await seedCreator(repositories);
  });

  it('tells every subscriber, whatever their level, that the channel went live', async () => {
    await seedSubscriber(repositories, userId(1), { level: 'none' });
    await goLive();

    const result = await announce();

    expect(result).toEqual({ liveStreamId: STREAM_ID, announced: 1, hasMore: false });
    expect(await eventsOf(1)).toEqual([
      {
        type: 'live.started',
        payload: {
          liveStreamId: STREAM_ID,
          videoId: VIDEO_ID,
          title: 'Speedrun',
          startedAt: STARTED.toISOString(),
          channel: expect.objectContaining({ id: CHANNEL_ID, handle: 'night-kitchen' }),
        },
      },
    ]);
  });

  it.each([
    { scenario: 'a broadcast that is not public', visibility: 'unlisted' as const, live: true },
    { scenario: 'a stream that is not live', visibility: 'public' as const, live: false },
  ])('tells nobody about $scenario', async ({ visibility, live }) => {
    await seedSubscriber(repositories, userId(1));
    if (live) await goLive(visibility);

    expect((await announce()).announced).toBe(0);
    expect(await eventsOf(1)).toEqual([]);
  });

  it('walks a big channel in batches, each enqueuing the next after its last subscriber', async () => {
    for (const n of [1, 2, 3]) await seedSubscriber(repositories, userId(n));
    await goLive();

    expect(await announce(undefined, 2)).toMatchObject({ announced: 2, hasMore: true });
    const [next] = expectOk(await queue.getJobs());
    expect(next).toMatchObject({
      name: 'announce-live',
      data: { liveStreamId: STREAM_ID, after: userId(2) },
    });
  });
});
