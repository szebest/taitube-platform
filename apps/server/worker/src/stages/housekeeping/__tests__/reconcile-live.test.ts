import { queueUnavailable } from '@kit/errors';
import { err } from '@kit/result';
import { expectOk } from '@kit/testing/result';
import { type InMemoryJobQueue, InMemoryRepositories } from '@vp/adapters/in-memory';
import { ErrorCodes } from '@vp/errors';
import { uuidv7 } from 'uuidv7';
import { runReconcileLive } from '../reconcile-live';
import { HOUR_MS, hoursAgo, inMemoryQueues } from './housekeeping-harness';

describe('housekeeping: reconcile-live', () => {
  let repositories: InMemoryRepositories;
  let getQueue: (name: string) => InMemoryJobQueue;

  const reconcile = async () =>
    expectOk(
      await runReconcileLive({
        repositories,
        getQueue,
        workerId: 'worker-spec',
        thresholdMs: 3 * HOUR_MS,
        scanLimit: 100,
      })
    );

  async function broadcast({ ended }: { ended: boolean }) {
    const channel = expectOk(
      await repositories.channels.create({ userId: uuidv7(), handle: 'live', displayName: 'Live' })
    );
    const [streamId, videoId] = [uuidv7(), uuidv7()];
    const seed = { id: streamId, streamKey: 'key', overlayToken: 'o', controlToken: 'c' };
    expectOk(await repositories.liveStreams.ensureIdle(channel.id, seed));
    expectOk(
      await repositories.liveStreams.goLive({
        streamId,
        video: {
          id: videoId,
          ownerId: channel.userId,
          channelId: channel.id,
          sourceKey: `live/${streamId}/`,
        },
        startedAt: hoursAgo(4),
        outbox: [],
      })
    );
    if (ended) {
      expectOk(
        await repositories.liveStreams.end({ streamId, endedAt: hoursAgo(4), nextId: uuidv7() })
      );
    }
    const video = expectOk(await repositories.videos.findById(videoId));
    if (video) video.updatedAt = hoursAgo(4);
    return videoId;
  }

  const statusOf = async (videoId: string) =>
    expectOk(await repositories.videos.findById(videoId))?.status;

  beforeEach(() => {
    repositories = new InMemoryRepositories();
    getQueue = inMemoryQueues();
  });

  it('fails a LIVE video whose stream ended with nothing left to finalize it', async () => {
    const videoId = await broadcast({ ended: true });

    expect((await reconcile()).orphanedCount).toBe(1);

    expect(expectOk(await repositories.videos.findById(videoId))).toMatchObject({
      status: 'FAILED',
      errorCode: ErrorCodes.ORPHANED,
    });
    expect(expectOk(await repositories.dlq.list({ limit: 10 }))).toEqual([
      expect.objectContaining({ videoId, errorCode: ErrorCodes.ORPHANED, queue: 'housekeeping' }),
    ]);
  });

  it.each([
    {
      scenario: 'its stream is still on air',
      ended: false,
      arrange: async () => {},
    },
    {
      scenario: 'a live job is still waiting for it',
      ended: true,
      arrange: async (videoId: string) => {
        await getQueue('live').add('live', { videoId, liveStreamId: uuidv7() });
      },
    },
    {
      scenario: 'the live queue cannot be inspected',
      ended: true,
      arrange: async () => {
        vi.spyOn(getQueue('live'), 'getJobs').mockResolvedValue(
          err(queueUnavailable('getJobs', 'redis down'))
        );
      },
    },
  ])('keeps the video LIVE when $scenario', async ({ ended, arrange }) => {
    const videoId = await broadcast({ ended });
    await arrange(videoId);

    expect((await reconcile()).orphanedCount).toBe(0);
    expect(await statusOf(videoId)).toBe('LIVE');
  });
});
