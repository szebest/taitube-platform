import type { VideoReactionRepositoryPort } from '@vp/core/repositories';
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

    beforeEach(async () => {
      await subject.reset();
      await seedOwners(subject.repositories);
      reactions = subject.repositories.videoReactions;
      await subject.repositories.videos.create(publicVideo({ id: VIDEO_IDS.a }));
      await subject.repositories.videos.create(publicVideo({ id: VIDEO_IDS.b }));
    });

    it('starts with no reaction and zeroed counts', async () => {
      expect(await reactions.getUserReaction(VIDEO_IDS.a, OWNER_ID)).toBeNull();
      expect(await reactions.getReactionCounts(VIDEO_IDS.a)).toEqual({
        likesCount: 0,
        dislikesCount: 0,
      });
    });

    it('records a like and reports the new totals', async () => {
      const result = await reactions.setReaction(VIDEO_IDS.a, OWNER_ID, 'LIKE');

      expect(result).toMatchObject({
        previousType: null,
        newType: 'LIKE',
        likesCount: 1,
        dislikesCount: 0,
      });
      expect(await reactions.getUserReaction(VIDEO_IDS.a, OWNER_ID)).toBe('LIKE');
    });

    it('moves a reaction from like to dislike without double counting', async () => {
      await reactions.setReaction(VIDEO_IDS.a, OWNER_ID, 'LIKE');
      const flipped = await reactions.setReaction(VIDEO_IDS.a, OWNER_ID, 'DISLIKE');

      expect(flipped).toMatchObject({
        previousType: 'LIKE',
        newType: 'DISLIKE',
        likesCount: 0,
        dislikesCount: 1,
      });
    });

    it('withdraws a reaction with NONE', async () => {
      await reactions.setReaction(VIDEO_IDS.a, OWNER_ID, 'LIKE');
      const cleared = await reactions.setReaction(VIDEO_IDS.a, OWNER_ID, 'NONE');

      expect(cleared).toMatchObject({ previousType: 'LIKE', newType: null, likesCount: 0 });
      expect(await reactions.getUserReaction(VIDEO_IDS.a, OWNER_ID)).toBeNull();
    });

    it('counts each user once per video', async () => {
      await reactions.setReaction(VIDEO_IDS.a, OWNER_ID, 'LIKE');
      await reactions.setReaction(VIDEO_IDS.a, OTHER_OWNER_ID, 'LIKE');
      await reactions.setReaction(VIDEO_IDS.b, OWNER_ID, 'DISLIKE');

      expect(await reactions.countGroundTruth(VIDEO_IDS.a)).toEqual({
        likesCount: 2,
        dislikesCount: 0,
      });
      expect(await reactions.countGroundTruth(VIDEO_IDS.b)).toEqual({
        likesCount: 0,
        dislikesCount: 1,
      });
    });

    it('writes the reconciled counters back onto the video', async () => {
      await reactions.updateVideoCounters(VIDEO_IDS.a, 11, 4);

      const video = await subject.repositories.videos.findById(VIDEO_IDS.a);
      expect(video).toMatchObject({ likesCount: 11, dislikesCount: 4 });
    });

    it('lists the videos that carry a reaction, and pages through them', async () => {
      await reactions.setReaction(VIDEO_IDS.a, OWNER_ID, 'LIKE');
      await reactions.setReaction(VIDEO_IDS.b, OWNER_ID, 'LIKE');

      const all = await reactions.listVideoIdsWithReactions();
      expect([...all].sort()).toEqual([VIDEO_IDS.a, VIDEO_IDS.b]);
      expect(await reactions.listVideoIdsWithReactions(1)).toHaveLength(1);
      expect(await reactions.listVideoIdsWithReactions(10, 2)).toEqual([]);
    });
  });
}
