import type { RecommendationFeedbackRepositoryPort } from '@vp/core/repositories';
import {
  type FeedbackTarget,
  RECOMMENDATION_FEEDBACK_LIMIT,
  type RecommendationFeedbackEntry,
} from '@vp/domain';
import type { UserContext } from '@vp/permissions';
import { expectOk } from '@vp/testing/result';
import { OTHER_OWNER_ID, OWNER_ID, VIDEO_IDS, publicVideo, seedOwners } from './fixtures';
import type { MakeRepositoriesSubject, RepositoriesSubject } from './subjects';

const BASE = Date.parse('2026-03-01T12:00:00.000Z');
const CHANNEL_ID = '00000000-0000-7000-8000-000000000901';
const OTHER_CHANNEL_ID = '00000000-0000-7000-8000-000000000902';

const rowId = (n: number) => `00000000-0000-7000-8000-${String(n).padStart(12, '0')}`;
const videoIdOf = (n: number) => `00000000-0000-7000-9000-${String(n).padStart(12, '0')}`;

const viewerOf = (id: string): UserContext => ({ id, role: 'USER' });

function entry(target: FeedbackTarget, minutesAgo = 0, userId = OTHER_OWNER_ID, n = 1) {
  return { ...target, id: rowId(n), userId, createdAt: new Date(BASE - minutesAgo * 60_000) };
}

const notInterested = (videoId: string): FeedbackTarget => ({ kind: 'not_interested', videoId });
const hideChannel = (channelId: string): FeedbackTarget => ({ kind: 'hide_channel', channelId });

export function describeRecommendationFeedbackRepositoryContract(
  makeSubject: MakeRepositoriesSubject
): void {
  describe('RecommendationFeedbackRepository contract', () => {
    let subject: RepositoriesSubject;
    let feedback: RecommendationFeedbackRepositoryPort;

    const list = async (
      userId = OTHER_OWNER_ID,
      options: { kind?: FeedbackTarget['kind']; limit?: number } = {}
    ) =>
      expectOk(
        await feedback.list(viewerOf(userId), {
          kind: options.kind ?? null,
          cursor: null,
          limit: options.limit ?? 2000,
        })
      );
    const idsOf = (rows: readonly RecommendationFeedbackEntry[]) => rows.map(({ id }) => id);

    beforeAll(async () => {
      subject = await makeSubject();
    });

    afterAll(async () => {
      await subject.close();
    });

    beforeEach(async () => {
      await subject.reset();
      const { repositories } = subject;
      await seedOwners(repositories);
      feedback = repositories.recommendationFeedback;
      await repositories.channels.create({
        id: CHANNEL_ID,
        userId: OWNER_ID,
        handle: 'owner-channel',
        displayName: 'Owner Channel',
      });
      await repositories.channels.create({
        id: OTHER_CHANNEL_ID,
        userId: OTHER_OWNER_ID,
        handle: 'other-channel',
        displayName: 'Other Channel',
      });
      await subject.seedVideo(publicVideo({ id: VIDEO_IDS.a }));
      await subject.seedVideo(publicVideo({ id: VIDEO_IDS.b }));
    });

    it('puts a video and a channel, and reads back what the user hid', async () => {
      const put = expectOk(
        await feedback.put(entry(notInterested(VIDEO_IDS.a), 1, OTHER_OWNER_ID, 1))
      );
      expectOk(await feedback.put(entry(hideChannel(CHANNEL_ID), 0, OTHER_OWNER_ID, 2)));

      expect(put).toEqual({
        id: rowId(1),
        kind: 'not_interested',
        videoId: VIDEO_IDS.a,
        createdAt: new Date(BASE - 60_000),
      });
      expect(expectOk(await feedback.hiddenOf(OTHER_OWNER_ID))).toEqual({
        videoIds: new Set([VIDEO_IDS.a]),
        channelIds: new Set([CHANNEL_ID]),
      });
    });

    it.each([
      { scenario: 'a video', target: notInterested(VIDEO_IDS.a) },
      { scenario: 'a channel', target: hideChannel(CHANNEL_ID) },
    ])('answers the row already there when $scenario is put again', async ({ target }) => {
      const first = expectOk(await feedback.put(entry(target, 5, OTHER_OWNER_ID, 1)));
      const again = expectOk(await feedback.put(entry(target, 0, OTHER_OWNER_ID, 2)));

      expect(again).toEqual(first);
      expect(idsOf(await list())).toEqual([rowId(1)]);
    });

    it('keeps a row for each user and target', async () => {
      expectOk(await feedback.put(entry(notInterested(VIDEO_IDS.a), 0, OTHER_OWNER_ID, 1)));
      expectOk(await feedback.put(entry(notInterested(VIDEO_IDS.a), 0, OWNER_ID, 2)));

      expect(await list(OTHER_OWNER_ID)).toHaveLength(1);
      expect(await list(OWNER_ID)).toHaveLength(1);
      expect(expectOk(await feedback.hiddenOf('00000000-0000-7000-8000-0000000001ff'))).toEqual({
        videoIds: new Set(),
        channelIds: new Set(),
      });
    });

    it('lists newest first with the video or channel of each row, and filters by kind', async () => {
      expectOk(await feedback.put(entry(notInterested(VIDEO_IDS.a), 2, OTHER_OWNER_ID, 1)));
      expectOk(await feedback.put(entry(hideChannel(CHANNEL_ID), 1, OTHER_OWNER_ID, 2)));

      const [channelRow, videoRow] = await list();

      expect(channelRow).toMatchObject({
        id: rowId(2),
        kind: 'hide_channel',
        video: null,
        channel: { id: CHANNEL_ID, handle: 'owner-channel' },
      });
      expect(videoRow).toMatchObject({
        id: rowId(1),
        kind: 'not_interested',
        video: { id: VIDEO_IDS.a },
        channel: { id: CHANNEL_ID },
      });
      expect(idsOf(await list(OTHER_OWNER_ID, { kind: 'not_interested' }))).toEqual([rowId(1)]);
      expect(idsOf(await list(OTHER_OWNER_ID, { kind: 'hide_channel' }))).toEqual([rowId(2)]);
    });

    it('lists a video the viewer may no longer watch with no video', async () => {
      const hidden = await subject.seedVideo(
        publicVideo({ id: VIDEO_IDS.c, ownerId: OWNER_ID, visibility: 'private' })
      );
      expectOk(await feedback.put(entry(notInterested(hidden.id), 0, OWNER_ID, 1)));
      expectOk(await feedback.put(entry(notInterested(VIDEO_IDS.a), 1, OWNER_ID, 2)));

      const [own, other] = await list(OWNER_ID);
      const [asStranger] = (await list(OWNER_ID)).slice(0, 1);

      expect(own?.video?.id).toBe(hidden.id);
      expect(other?.video?.id).toBe(VIDEO_IDS.a);
      expect(asStranger?.id).toBe(rowId(1));
      expect(
        expectOk(
          await feedback.list(viewerOf(OTHER_OWNER_ID), { kind: null, cursor: null, limit: 5 })
        )
      ).toEqual([]);
    });

    it('walks on from a cursor, ties on the time broken by id', async () => {
      expectOk(await feedback.put(entry(notInterested(VIDEO_IDS.a), 5, OTHER_OWNER_ID, 1)));
      expectOk(await feedback.put(entry(notInterested(VIDEO_IDS.b), 1, OTHER_OWNER_ID, 2)));
      expectOk(await feedback.put(entry(hideChannel(CHANNEL_ID), 1, OTHER_OWNER_ID, 3)));
      expectOk(await feedback.put(entry(hideChannel(OTHER_CHANNEL_ID), 9, OTHER_OWNER_ID, 4)));

      const first = expectOk(
        await feedback.list(viewerOf(OTHER_OWNER_ID), { kind: null, cursor: null, limit: 2 })
      );
      const last = first[1];
      const rest = last
        ? expectOk(
            await feedback.list(viewerOf(OTHER_OWNER_ID), {
              kind: null,
              cursor: { createdAt: last.createdAt, id: last.id },
              limit: 5,
            })
          )
        : [];

      expect(idsOf(first)).toEqual([rowId(3), rowId(2), rowId(1)]);
      expect(idsOf(rest)).toEqual([rowId(1), rowId(4)]);
    });

    it('removes one row of the caller, and nothing of anyone else', async () => {
      expectOk(await feedback.put(entry(notInterested(VIDEO_IDS.a), 0, OTHER_OWNER_ID, 1)));
      expectOk(await feedback.put(entry(notInterested(VIDEO_IDS.a), 0, OWNER_ID, 2)));

      expect(expectOk(await feedback.remove(OTHER_OWNER_ID, rowId(2)))).toBe(false);
      expect(expectOk(await feedback.remove(OTHER_OWNER_ID, rowId(1)))).toBe(true);
      expect(expectOk(await feedback.remove(OTHER_OWNER_ID, rowId(1)))).toBe(false);
      expect(idsOf(await list(OWNER_ID))).toEqual([rowId(2)]);
      expect(expectOk(await feedback.hiddenOf(OTHER_OWNER_ID)).videoIds.size).toBe(0);
    });

    it('lets a removed target be put again as a new row', async () => {
      expectOk(await feedback.put(entry(hideChannel(CHANNEL_ID), 0, OTHER_OWNER_ID, 1)));
      expectOk(await feedback.remove(OTHER_OWNER_ID, rowId(1)));

      const again = expectOk(
        await feedback.put(entry(hideChannel(CHANNEL_ID), 0, OTHER_OWNER_ID, 2))
      );

      expect(again.id).toBe(rowId(2));
    });

    describe('at the limit', () => {
      const fill = async (userId: string) => {
        for (let n = 0; n < RECOMMENDATION_FEEDBACK_LIMIT; n++) {
          await subject.seedVideo(publicVideo({ id: videoIdOf(n) }));
          expectOk(
            await feedback.put(
              entry(notInterested(videoIdOf(n)), RECOMMENDATION_FEEDBACK_LIMIT - n, userId, n + 10)
            )
          );
        }
      };

      it('drops nothing for a target already there, and keeps the newest rows past it, for that user only', async () => {
        await fill(OTHER_OWNER_ID);

        expectOk(await feedback.put(entry(notInterested(videoIdOf(0)), 0, OTHER_OWNER_ID, 5002)));
        expect(await list()).toHaveLength(RECOMMENDATION_FEEDBACK_LIMIT);

        expectOk(await feedback.put(entry(notInterested(VIDEO_IDS.a), 5000, OWNER_ID, 5000)));
        expectOk(await feedback.put(entry(hideChannel(CHANNEL_ID), 0, OTHER_OWNER_ID, 5001)));
        const kept = await list();

        expect(kept).toHaveLength(RECOMMENDATION_FEEDBACK_LIMIT);
        expect(kept[0]?.id).toBe(rowId(5001));
        expect(idsOf(kept)).not.toContain(rowId(10));
        expect(idsOf(kept)).toContain(rowId(11));
        expect(await list(OWNER_ID)).toHaveLength(1);
      });
    });
  });
}
