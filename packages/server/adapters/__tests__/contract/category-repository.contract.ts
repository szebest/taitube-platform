import type { CategoryRepositoryPort } from '@vp/core/repositories';
import { ErrorCodes } from '@vp/errors';
import { expectErr, expectOk } from '@vp/testing/result';
import {
  CATEGORY_GAMING_ID,
  CATEGORY_MUSIC_ID,
  VIDEO_IDS,
  publicVideo,
  seedOwners,
} from './fixtures';
import type { MakeRepositoriesSubject, RepositoriesSubject } from './subjects';

export function describeCategoryRepositoryContract(makeSubject: MakeRepositoriesSubject): void {
  describe('CategoryRepository contract', () => {
    let subject: RepositoriesSubject;
    let categories: CategoryRepositoryPort;

    beforeAll(async () => {
      subject = await makeSubject();
    });

    beforeEach(async () => {
      await subject.reset();
      categories = subject.repositories.categories;
      expectOk(
        await categories.create({
          id: CATEGORY_GAMING_ID,
          slug: 'gaming',
          name: 'Gaming',
          sortOrder: 2,
        })
      );
      expectOk(
        await categories.create({
          id: CATEGORY_MUSIC_ID,
          slug: 'music',
          name: 'Music',
          sortOrder: 1,
        })
      );
    });

    it('applies the declared defaults on create', async () => {
      expect(expectOk(await categories.findById(CATEGORY_MUSIC_ID))).toMatchObject({
        slug: 'music',
        name: 'Music',
        description: null,
        iconUrl: null,
        sortOrder: 1,
        isActive: true,
      });
    });

    it('lists by sort order then name', async () => {
      expect(expectOk(await categories.findAll()).map((c) => c.slug)).toEqual(['music', 'gaming']);
    });

    it('finds by slug and answers ok(null) for an unknown one', async () => {
      expect(expectOk(await categories.findBySlug('gaming'))?.id).toBe(CATEGORY_GAMING_ID);
      expect(expectOk(await categories.findBySlug('nope'))).toBeNull();
      expect(expectOk(await categories.findById(VIDEO_IDS.f))).toBeNull();
    });

    it('hides deactivated categories behind activeOnly', async () => {
      expectOk(await categories.update(CATEGORY_GAMING_ID, { isActive: false }));

      expect(expectOk(await categories.findAll()).map((c) => c.slug)).toEqual(['music', 'gaming']);
      expect(expectOk(await categories.findAll({ activeOnly: true })).map((c) => c.slug)).toEqual([
        'music',
      ]);
    });

    it('patches only the supplied fields', async () => {
      const updated = expectOk(
        await categories.update(CATEGORY_MUSIC_ID, { name: 'Music & Audio' })
      );

      expect(updated?.name).toBe('Music & Audio');
      expect(updated?.slug).toBe('music');
    });

    it('answers ok(null) when updating a row that is not there', async () => {
      expect(expectOk(await categories.update(VIDEO_IDS.f, { name: 'Ghost' }))).toBeNull();
    });

    it('reports a duplicate slug as CATEGORY_SLUG_CONFLICT on create', async () => {
      const failure = expectErr(await categories.create({ slug: 'music', name: 'Another' }));

      expect(failure.code).toBe(ErrorCodes.CATEGORY_SLUG_CONFLICT);
    });

    it('reports a duplicate slug as CATEGORY_SLUG_CONFLICT on update', async () => {
      const failure = expectErr(await categories.update(CATEGORY_GAMING_ID, { slug: 'music' }));

      expect(failure.code).toBe(ErrorCodes.CATEGORY_SLUG_CONFLICT);
    });

    it('deletes a category', async () => {
      expectOk(await categories.delete(CATEGORY_GAMING_ID));

      expect(expectOk(await categories.findById(CATEGORY_GAMING_ID))).toBeNull();
    });

    it('deleting a row that is not there is not a failure', async () => {
      expectOk(await categories.delete(VIDEO_IDS.f));
    });

    it('counts the videos assigned to a category', async () => {
      await seedOwners(subject.repositories);
      await subject.repositories.videos.create(
        publicVideo({ id: VIDEO_IDS.a, categoryId: CATEGORY_MUSIC_ID })
      );
      await subject.repositories.videos.create(
        publicVideo({ id: VIDEO_IDS.b, categoryId: CATEGORY_MUSIC_ID })
      );
      await subject.repositories.videos.create(
        publicVideo({ id: VIDEO_IDS.c, categoryId: CATEGORY_GAMING_ID })
      );

      expect(expectOk(await categories.countVideos(CATEGORY_MUSIC_ID))).toBe(2);
      expect(expectOk(await categories.countVideos(CATEGORY_GAMING_ID))).toBe(1);
    });
  });
}
