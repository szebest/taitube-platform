import type { RelatedVideosOptions, Repositories } from '@vp/core/repositories';
import { expectOk } from '@vp/testing/result';
import {
  CATEGORY_GAMING_ID,
  CATEGORY_MUSIC_ID,
  OTHER_OWNER_ID,
  OWNER_ID,
  publicVideo,
  seedCategories,
  seedOwners,
  VIDEO_IDS,
} from './fixtures';
import type { MakeRepositoriesSubject, RepositoriesSubject } from './subjects';

const {
  a: ANCHOR,
  b: CO_WATCHED,
  c: TAGGED,
  d: SAME_CHANNEL,
  e: SAME_CATEGORY,
  f: UNRELATED,
} = VIDEO_IDS;

const WATCHED_AT = new Date('2026-03-01T12:00:00.000Z');

function watch(repositories: Repositories, userId: string, videoId: string) {
  return repositories.watchHistory.record({
    id: `00000000-0000-7000-8000-0000000007${videoId.slice(-2)}`,
    userId,
    videoId,
    progressSeconds: 30,
    durationSeconds: 60,
    watchedAt: WATCHED_AT,
  });
}

export function describeRelatedVideosRepositoryContract(
  makeSubject: MakeRepositoriesSubject
): void {
  describe('RelatedVideosRepository contract', () => {
    let subject: RepositoriesSubject;

    const options = (overrides: Partial<RelatedVideosOptions> = {}): RelatedVideosOptions => ({
      videoId: ANCHOR,
      ownerId: OWNER_ID,
      categoryId: CATEGORY_MUSIC_ID,
      tags: ['lisbon', 'night'],
      excludeOwnerId: null,
      limit: 10,
      ...overrides,
    });

    const related = async (overrides?: Partial<RelatedVideosOptions>) =>
      expectOk(await subject.repositories.related.find(options(overrides)));

    beforeAll(async () => {
      subject = await makeSubject();
    });

    afterAll(async () => {
      await subject.close();
    });

    beforeEach(async () => {
      await subject.reset();
      await seedOwners(subject.repositories);
      await seedCategories(subject.repositories);
      const { videos } = subject.repositories;
      const seeds = [
        { id: ANCHOR, tags: ['lisbon', 'night'], categoryId: CATEGORY_MUSIC_ID },
        { id: CO_WATCHED, ownerId: OTHER_OWNER_ID, categoryId: CATEGORY_GAMING_ID },
        { id: TAGGED, ownerId: OTHER_OWNER_ID, tags: ['lisbon', 'night', 'tram'] },
        { id: SAME_CHANNEL, categoryId: CATEGORY_GAMING_ID },
        { id: SAME_CATEGORY, ownerId: OTHER_OWNER_ID, categoryId: CATEGORY_MUSIC_ID },
        { id: UNRELATED, ownerId: OTHER_OWNER_ID, categoryId: CATEGORY_GAMING_ID },
      ];
      for (const seed of seeds) {
        expectOk(await videos.create(publicVideo(seed)));
      }
      expectOk(await watch(subject.repositories, OWNER_ID, ANCHOR));
      expectOk(await watch(subject.repositories, OWNER_ID, CO_WATCHED));
    });

    it('answers every video that shares a signal with the signals it matched on', async () => {
      const found = await related();

      expect(
        found
          .map(({ video, signals }) => ({ id: video.id, signals }))
          .toSorted((x, y) => x.id.localeCompare(y.id))
      ).toEqual([
        {
          id: CO_WATCHED,
          signals: { coWatchers: 1, sharedTags: 0, sameChannel: false, sameCategory: false },
        },
        {
          id: TAGGED,
          signals: { coWatchers: 0, sharedTags: 2, sameChannel: false, sameCategory: false },
        },
        {
          id: SAME_CHANNEL,
          signals: { coWatchers: 0, sharedTags: 0, sameChannel: true, sameCategory: false },
        },
        {
          id: SAME_CATEGORY,
          signals: { coWatchers: 0, sharedTags: 0, sameChannel: false, sameCategory: true },
        },
      ]);
    });

    it('leaves out the anchor, the caller own uploads, and anything not public and ready', async () => {
      const { videos } = subject.repositories;
      for (const seed of [
        { id: '00000000-0000-7000-8000-0000000000a1', visibility: 'private' as const },
        { id: '00000000-0000-7000-8000-0000000000a2', visibility: 'unlisted' as const },
        { id: '00000000-0000-7000-8000-0000000000a3', status: 'PROBING' as const },
        { id: '00000000-0000-7000-8000-0000000000a4', status: 'DELETED' as const },
      ]) {
        expectOk(await videos.create(publicVideo({ ...seed, tags: ['lisbon'] })));
      }

      const found = await related({ excludeOwnerId: OTHER_OWNER_ID });

      expect(found.map(({ video }) => video.id).toSorted()).toEqual([SAME_CHANNEL]);
    });

    it('still returns the strongest matches from a catalogue far larger than a page', async () => {
      const { videos } = subject.repositories;
      for (let index = 0; index < 300; index++) {
        const id = `00000000-0000-7000-8001-${String(index).padStart(12, '0')}`;
        expectOk(
          await videos.create(
            publicVideo({ id, ownerId: OTHER_OWNER_ID, categoryId: CATEGORY_MUSIC_ID })
          )
        );
      }

      const found = await related({ limit: 5 });

      expect(found).toHaveLength(5);
      expect(found.slice(0, 2).map(({ video }) => video.id)).toEqual([CO_WATCHED, TAGGED]);
    });

    it('stops at the limit', async () => {
      expect(await related({ limit: 2 })).toHaveLength(2);
    });
  });
}
