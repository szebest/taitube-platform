import type { RisingVideosRepositoryPort } from '@vp/core/repositories';
import { RISING } from '@vp/domain';
import { expectOk } from '@vp/testing/result';
import { HOUR_MS, VIDEO_IDS, idsOf, publicVideo } from './fixtures';
import type { MakeRepositoriesSubject, RepositoriesSubject } from './subjects';

const NOW = Date.parse('2026-03-20T12:00:00.000Z');
const SINCE = new Date(NOW - RISING.windowDays * 24 * HOUR_MS);

const creatorId = (n: number) => `00000000-0000-7000-8000-0000000003${String(n).padStart(2, '0')}`;

const options = (overrides: Partial<Parameters<RisingVideosRepositoryPort['find']>[0]> = {}) => ({
  since: SINCE,
  excludeOwnerId: null,
  excludeVideoIds: [],
  limit: 12,
  ...overrides,
});

export function describeRisingVideosRepositoryContract(makeSubject: MakeRepositoriesSubject): void {
  describe('RisingVideosRepository contract', () => {
    let subject: RepositoriesSubject;
    let rising: RisingVideosRepositoryPort;

    const find = async (overrides = {}) => idsOf(expectOk(await rising.find(options(overrides))));

    /** A channel of `subscribers`, one video made `daysAgo`, with `sessions` viewers and `completed` of them at the end. */
    const publish = async (
      n: number,
      video: {
        id: string;
        sessions: number;
        completed: number;
        daysAgo?: number;
        visibility?: 'public' | 'private';
      },
      subscribers = 10
    ) => {
      const { repositories } = subject;
      await repositories.users.upsert({
        id: creatorId(n),
        email: `creator${n}@video-pipeline.local`,
      });
      await repositories.channels.create({
        id: creatorId(n + 50),
        userId: creatorId(n),
        handle: `creator-${n}`,
        displayName: `Creator ${n}`,
        subscriberCount: subscribers,
      });
      await subject.seedVideo(
        publicVideo({
          id: video.id,
          ownerId: creatorId(n),
          ...(video.visibility && { visibility: video.visibility }),
        }),
        new Date(NOW - (video.daysAgo ?? 1) * 24 * HOUR_MS)
      );
      await retain(video.id, video.sessions, video.completed);
    };

    const retain = async (videoId: string, sessions: number, completed: number) => {
      expectOk(
        await subject.repositories.videoViews.applyBatch({
          batchId: `batch-${videoId}-${sessions}-${completed}`,
          counts: [],
          retention: [
            { videoId, percent: RISING.startPercent, viewers: sessions },
            { videoId, percent: RISING.completedPercent, viewers: completed },
          ],
        })
      );
    };

    beforeAll(async () => {
      subject = await makeSubject();
    });

    afterAll(async () => {
      await subject.close();
    });

    beforeEach(async () => {
      await subject.reset();
      rising = subject.repositories.rising;
    });

    it('orders by completion ratio, ties by newest', async () => {
      await publish(1, { id: VIDEO_IDS.a, sessions: 100, completed: 40 });
      await publish(2, { id: VIDEO_IDS.b, sessions: 50, completed: 40 });
      await publish(3, { id: VIDEO_IDS.c, sessions: 20, completed: 8, daysAgo: 3 });
      await publish(4, { id: VIDEO_IDS.d, sessions: 20, completed: 8, daysAgo: 2 });

      expect(await find()).toEqual([VIDEO_IDS.b, VIDEO_IDS.a, VIDEO_IDS.d, VIDEO_IDS.c]);
    });

    it.each([
      {
        scenario: 'a channel over the subscriber cap',
        subscribers: RISING.maxSubscribers + 1,
        sessions: 50,
        daysAgo: 1,
        visibility: 'public' as const,
      },
      {
        scenario: 'too few sessions',
        subscribers: 10,
        sessions: RISING.minSessions - 1,
        daysAgo: 1,
        visibility: 'public' as const,
      },
      {
        scenario: 'a video older than the window',
        subscribers: 10,
        sessions: 50,
        daysAgo: RISING.windowDays + 1,
        visibility: 'public' as const,
      },
      {
        scenario: 'a private video',
        subscribers: 10,
        sessions: 50,
        daysAgo: 1,
        visibility: 'private' as const,
      },
    ])('leaves out $scenario', async ({ subscribers, sessions, daysAgo, visibility }) => {
      await publish(
        1,
        { id: VIDEO_IDS.a, sessions, completed: sessions, daysAgo, visibility },
        subscribers
      );
      await publish(2, { id: VIDEO_IDS.b, sessions: 20, completed: 1 });

      expect(await find()).toEqual([VIDEO_IDS.b]);
    });

    it('keeps the cap and the floor themselves', async () => {
      await publish(
        1,
        { id: VIDEO_IDS.a, sessions: RISING.minSessions, completed: 5 },
        RISING.maxSubscribers
      );

      expect(await find()).toEqual([VIDEO_IDS.a]);
    });

    it('takes one video for each channel, the one finished most', async () => {
      await publish(1, { id: VIDEO_IDS.a, sessions: 100, completed: 10 });
      await subject.seedVideo(
        publicVideo({ id: VIDEO_IDS.b, ownerId: creatorId(1) }),
        new Date(NOW - HOUR_MS)
      );
      await retain(VIDEO_IDS.b, 100, 90);
      await publish(2, { id: VIDEO_IDS.c, sessions: 100, completed: 50 });

      expect(await find()).toEqual([VIDEO_IDS.b, VIDEO_IDS.c]);
    });

    it('leaves out the caller own uploads and the videos named, and honours the limit', async () => {
      await publish(1, { id: VIDEO_IDS.a, sessions: 100, completed: 90 });
      await publish(2, { id: VIDEO_IDS.b, sessions: 100, completed: 80 });
      await publish(3, { id: VIDEO_IDS.c, sessions: 100, completed: 70 });
      await publish(4, { id: VIDEO_IDS.d, sessions: 100, completed: 60 });

      expect(await find({ excludeOwnerId: creatorId(1) })).toEqual([
        VIDEO_IDS.b,
        VIDEO_IDS.c,
        VIDEO_IDS.d,
      ]);
      expect(await find({ excludeVideoIds: [VIDEO_IDS.b] })).toEqual([
        VIDEO_IDS.a,
        VIDEO_IDS.c,
        VIDEO_IDS.d,
      ]);
      expect(await find({ limit: 2 })).toEqual([VIDEO_IDS.a, VIDEO_IDS.b]);
    });

    it('answers nothing when no retention was recorded', async () => {
      await subject.repositories.users.upsert({
        id: creatorId(1),
        email: 'c@video-pipeline.local',
      });
      await subject.repositories.channels.create({
        id: creatorId(51),
        userId: creatorId(1),
        handle: 'c',
        displayName: 'C',
      });
      await subject.seedVideo(
        publicVideo({ id: VIDEO_IDS.a, ownerId: creatorId(1) }),
        new Date(NOW - HOUR_MS)
      );

      expect(await find()).toEqual([]);
    });
  });
}
