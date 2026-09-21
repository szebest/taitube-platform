import type { CategoryRepositoryPort } from '@vp/core/repositories';
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
      await categories.create({
        id: CATEGORY_GAMING_ID,
        slug: 'gaming',
        name: 'Gaming',
        sortOrder: 2,
      });
      await categories.create({
        id: CATEGORY_MUSIC_ID,
        slug: 'music',
        name: 'Music',
        sortOrder: 1,
      });
    });

    it('applies the declared defaults on create', async () => {
      const created = await categories.findById(CATEGORY_MUSIC_ID);
      expect(created).toMatchObject({
        slug: 'music',
        name: 'Music',
        description: null,
        iconUrl: null,
        sortOrder: 1,
        isActive: true,
      });
    });

    it('lists by sort order then name', async () => {
      const all = await categories.findAll();
      expect(all.map((c) => c.slug)).toEqual(['music', 'gaming']);
    });

    it('finds by slug and returns null for an unknown one', async () => {
      expect((await categories.findBySlug('gaming'))?.id).toBe(CATEGORY_GAMING_ID);
      expect(await categories.findBySlug('nope')).toBeNull();
      expect(await categories.findById(VIDEO_IDS.f)).toBeNull();
    });

    it('hides deactivated categories behind activeOnly', async () => {
      await categories.update(CATEGORY_GAMING_ID, { isActive: false });

      expect((await categories.findAll()).map((c) => c.slug)).toEqual(['music', 'gaming']);
      expect((await categories.findAll({ activeOnly: true })).map((c) => c.slug)).toEqual([
        'music',
      ]);
    });

    it('patches only the supplied fields', async () => {
      const updated = await categories.update(CATEGORY_MUSIC_ID, { name: 'Music & Audio' });
      expect(updated.name).toBe('Music & Audio');
      expect(updated.slug).toBe('music');
    });

    it('deletes a category', async () => {
      await categories.delete(CATEGORY_GAMING_ID);
      expect(await categories.findById(CATEGORY_GAMING_ID)).toBeNull();
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

      expect(await categories.countVideos(CATEGORY_MUSIC_ID)).toBe(2);
      expect(await categories.countVideos(CATEGORY_GAMING_ID)).toBe(1);
    });
  });
}
