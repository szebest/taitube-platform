import type { VideoReactionRepositoryPort } from '@vp/core/repositories';
import type { LikedVideoEntry } from '@vp/domain';
import type { UserContext } from '@vp/permissions';
import { expectOk } from '@vp/testing/result';
import { OTHER_OWNER_ID, OWNER_ID, VIDEO_IDS, publicVideo, seedOwners } from './fixtures';
import type { MakeRepositoriesSubject, RepositoriesSubject } from './subjects';

export function describeVideoReactionRepositoryContract(
  makeSubject: MakeRepositoriesSubject
): void {
  describe('VideoReactionRepository contract', () => {
    let subject: RepositoriesSubject;
    let reactions: VideoReactionRepositoryPort;

    beforeAll(async () => {
      subject = await makeSubject();
    });

    afterAll(async () => {
      await subject.close();
    });

    beforeEach(async () => {
      await subject.reset();
      await seedOwners(subject.repositories);
      reactions = subject.repositories.videoReactions;
      await subject.repositories.videos.create(publicVideo({ id: VIDEO_IDS.a }));
      await subject.repositories.videos.create(publicVideo({ id: VIDEO_IDS.b }));
    });

    it('starts with no reaction and zeroed counts', async () => {
      expect(expectOk(await reactions.getUserReaction(VIDEO_IDS.a, OWNER_ID))).toBeNull();
      expect(expectOk(await reactions.getReactionCounts(VIDEO_IDS.a))).toEqual({
        likesCount: 0,
        dislikesCount: 0,
      });
    });

    it('records a like and reports the new totals', async () => {
      const result = expectOk(await reactions.setReaction(VIDEO_IDS.a, OWNER_ID, 'LIKE'));

      expect(result).toMatchObject({
        previousType: null,
        newType: 'LIKE',
        likesCount: 1,
        dislikesCount: 0,
      });
      expect(expectOk(await reactions.getUserReaction(VIDEO_IDS.a, OWNER_ID))).toBe('LIKE');
    });

    it('moves a reaction from like to dislike without double counting', async () => {
      await reactions.setReaction(VIDEO_IDS.a, OWNER_ID, 'LIKE');
      const flipped = expectOk(await reactions.setReaction(VIDEO_IDS.a, OWNER_ID, 'DISLIKE'));

      expect(flipped).toMatchObject({
        previousType: 'LIKE',
        newType: 'DISLIKE',
        likesCount: 0,
        dislikesCount: 1,
      });
    });

    it('withdraws a reaction with NONE', async () => {
      await reactions.setReaction(VIDEO_IDS.a, OWNER_ID, 'LIKE');
      const cleared = expectOk(await reactions.setReaction(VIDEO_IDS.a, OWNER_ID, 'NONE'));

      expect(cleared).toMatchObject({ previousType: 'LIKE', newType: null, likesCount: 0 });
      expect(expectOk(await reactions.getUserReaction(VIDEO_IDS.a, OWNER_ID))).toBeNull();
    });

    it('counts each user once per video', async () => {
      await reactions.setReaction(VIDEO_IDS.a, OWNER_ID, 'LIKE');
      await reactions.setReaction(VIDEO_IDS.a, OTHER_OWNER_ID, 'LIKE');
      await reactions.setReaction(VIDEO_IDS.b, OWNER_ID, 'DISLIKE');

      expect(expectOk(await reactions.countGroundTruth(VIDEO_IDS.a))).toEqual({
        likesCount: 2,
        dislikesCount: 0,
      });
      expect(expectOk(await reactions.countGroundTruth(VIDEO_IDS.b))).toEqual({
        likesCount: 0,
        dislikesCount: 1,
      });
    });

    it('keeps the denormalised counters on the video in step with each reaction', async () => {
      await reactions.setReaction(VIDEO_IDS.a, OWNER_ID, 'LIKE');
      await reactions.setReaction(VIDEO_IDS.a, OTHER_OWNER_ID, 'DISLIKE');

      expect(expectOk(await subject.repositories.videos.findById(VIDEO_IDS.a))).toMatchObject({
        likesCount: 1,
        dislikesCount: 1,
      });
    });

    it('writes the reconciled counters back onto the video', async () => {
      await reactions.updateVideoCounters(VIDEO_IDS.a, 11, 4);

      const video = expectOk(await subject.repositories.videos.findById(VIDEO_IDS.a));
      expect(video).toMatchObject({ likesCount: 11, dislikesCount: 4 });
    });

    it('lists the videos that carry a reaction, and pages through them', async () => {
      await reactions.setReaction(VIDEO_IDS.a, OWNER_ID, 'LIKE');
      await reactions.setReaction(VIDEO_IDS.b, OWNER_ID, 'LIKE');

      const all = expectOk(await reactions.listVideoIdsWithReactions(100));
      expect([...all].sort()).toEqual([VIDEO_IDS.a, VIDEO_IDS.b]);
      expect(expectOk(await reactions.listVideoIdsWithReactions(1))).toHaveLength(1);
      expect(expectOk(await reactions.listVideoIdsWithReactions(10, 2))).toEqual([]);
    });
    describe('liked videos', () => {
      const VIEWER: UserContext = { id: OTHER_OWNER_ID, role: 'USER' };

      const videosOf = (entries: readonly LikedVideoEntry[]) =>
        entries.map((entry) => entry.video.id);

      const liked = async (limit = 10) =>
        expectOk(await reactions.listLiked(VIEWER, { cursor: null, limit }));

      beforeEach(async () => {
        await subject.repositories.videos.create(publicVideo({ id: VIDEO_IDS.c }));
        await subject.repositories.channels.create({
          userId: OWNER_ID,
          handle: 'owner',
          displayName: 'The Owner',
        });
      });

      it('lists the likes newest first with the video and its channel, and walks on from a cursor', async () => {
        for (const videoId of [VIDEO_IDS.a, VIDEO_IDS.b, VIDEO_IDS.c]) {
          await reactions.setReaction(videoId, VIEWER.id, 'LIKE');
        }

        const first = await liked(1);
        const last = first[0];
        const rest = last
          ? expectOk(
              await reactions.listLiked(VIEWER, {
                cursor: { likedAt: last.likedAt, id: last.id },
                limit: 5,
              })
            )
          : [];

        expect(videosOf(first)).toEqual([VIDEO_IDS.c, VIDEO_IDS.b]);
        expect(first[0]?.video).toMatchObject({ id: VIDEO_IDS.c, status: 'READY' });
        expect(first[0]?.channel).toMatchObject({ handle: 'owner' });
        expect(videosOf(rest)).toEqual([VIDEO_IDS.b, VIDEO_IDS.a]);
      });

      it('lists only the caller likes, and no dislike or withdrawn like', async () => {
        await reactions.setReaction(VIDEO_IDS.a, VIEWER.id, 'LIKE');
        await reactions.setReaction(VIDEO_IDS.b, VIEWER.id, 'DISLIKE');
        await reactions.setReaction(VIDEO_IDS.c, VIEWER.id, 'LIKE');
        await reactions.setReaction(VIDEO_IDS.c, VIEWER.id, 'NONE');
        await reactions.setReaction(VIDEO_IDS.b, OWNER_ID, 'LIKE');

        expect(videosOf(await liked())).toEqual([VIDEO_IDS.a]);
      });

      it('drops a video the viewer may no longer watch, and one that was deleted', async () => {
        const hidden = '00000000-0000-7000-8000-0000000000f7';
        const deleted = '00000000-0000-7000-8000-0000000000f8';
        await subject.repositories.videos.create(
          publicVideo({ id: hidden, visibility: 'private' })
        );
        await subject.repositories.videos.create(publicVideo({ id: deleted, status: 'DELETED' }));
        for (const videoId of [hidden, deleted, VIDEO_IDS.c]) {
          await reactions.setReaction(videoId, VIEWER.id, 'LIKE');
        }

        expect(videosOf(await liked())).toEqual([VIDEO_IDS.c]);
      });
    });
  });
}
