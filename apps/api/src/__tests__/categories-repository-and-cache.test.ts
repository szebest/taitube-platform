import { inProcessAppConfig } from '@vp/env-schema';
import {
  InMemoryCacheClient,
  InMemoryCategoryRepository,
  InMemoryVideoRepository,
} from '@vp/adapters/in-memory';
import { RedisCategoryCacheAdapter } from '@vp/adapters/redis/redis-category-cache.adapter';
import type { Category } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { ok } from '@vp/result';
import { expectErr, expectOk } from '@vp/testing/result';

const CACHES = inProcessAppConfig().caches;

const VIDEO_ID = '018f0000-0000-7000-8000-000000000001';

function aCategoryRow(overrides: Partial<Category> = {}): Category {
  return {
    id: 'cat-1',
    slug: 'art',
    name: 'Art',
    description: null,
    iconUrl: null,
    sortOrder: 0,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('Category Repositories & L1/L2 Cache Service (Ticket 37)', () => {
  describe('InMemoryCategoryRepository', () => {
    let repo: InMemoryCategoryRepository;
    let videoRepo: InMemoryVideoRepository;

    beforeEach(() => {
      videoRepo = new InMemoryVideoRepository();
      repo = new InMemoryCategoryRepository({ videosRepo: videoRepo });
    });

    it('creates a category with default sortOrder and isActive', async () => {
      const created = expectOk(
        await repo.create({ name: 'Technology', slug: 'tech', description: 'Tech videos' })
      );

      expect(created).toMatchObject({
        name: 'Technology',
        slug: 'tech',
        description: 'Tech videos',
        sortOrder: 0,
        isActive: true,
      });
      expect(created.id).toBeDefined();
      expect(created.createdAt).toBeInstanceOf(Date);
    });

    it('returns CATEGORY_SLUG_CONFLICT for a duplicate slug instead of throwing', async () => {
      expectOk(await repo.create({ name: 'Tech 1', slug: 'tech' }));

      const failure = expectErr(await repo.create({ name: 'Tech 2', slug: 'tech' }));

      expect(failure.code).toBe(ErrorCodes.CATEGORY_SLUG_CONFLICT);
    });

    it('finds by id and by slug', async () => {
      const created = expectOk(await repo.create({ name: 'Gaming', slug: 'gaming' }));

      expect(expectOk(await repo.findById(created.id))).toEqual(created);
      expect(expectOk(await repo.findBySlug('gaming'))).toEqual(created);
    });

    it.each([
      { name: 'findById', read: (r: InMemoryCategoryRepository) => r.findById('non-existent') },
      { name: 'findBySlug', read: (r: InMemoryCategoryRepository) => r.findBySlug('non-existent') },
    ])(
      '$name answers ok(null) for an absent row, because absence is not a failure',
      async ({ read }) => {
        expect(expectOk(await read(repo))).toBeNull();
      }
    );

    it('sorts by sortOrder then name, and filters activeOnly', async () => {
      expectOk(await repo.create({ name: 'Zebra', slug: 'zebra', sortOrder: 1, isActive: true }));
      expectOk(await repo.create({ name: 'Apple', slug: 'apple', sortOrder: 1, isActive: true }));
      expectOk(await repo.create({ name: 'Beta', slug: 'beta', sortOrder: 0, isActive: true }));
      expectOk(
        await repo.create({ name: 'Inactive', slug: 'inactive', sortOrder: 0, isActive: false })
      );

      expect(expectOk(await repo.findAll()).map((c) => c.slug)).toEqual([
        'beta',
        'inactive',
        'apple',
        'zebra',
      ]);
      expect(expectOk(await repo.findAll({ activeOnly: true })).map((c) => c.slug)).toEqual([
        'beta',
        'apple',
        'zebra',
      ]);
    });

    it('patches the supplied fields', async () => {
      const created = expectOk(await repo.create({ name: 'Original', slug: 'orig' }));

      const updated = expectOk(await repo.update(created.id, { name: 'Renamed', sortOrder: 5 }));

      expect(updated).toMatchObject({ name: 'Renamed', sortOrder: 5, slug: 'orig' });
    });

    it('returns CATEGORY_SLUG_CONFLICT when a patch takes a slug another row holds', async () => {
      const first = expectOk(await repo.create({ name: 'Original', slug: 'orig' }));
      expectOk(await repo.create({ name: 'Other', slug: 'other' }));

      const failure = expectErr(await repo.update(first.id, { slug: 'other' }));

      expect(failure.code).toBe(ErrorCodes.CATEGORY_SLUG_CONFLICT);
    });

    it('answers ok(null) when patching a row that is not there', async () => {
      expect(expectOk(await repo.update('non-existent', { name: 'Fail' }))).toBeNull();
    });

    it('counts only the videos still holding the category', async () => {
      const category = expectOk(await repo.create({ name: 'Film', slug: 'film' }));
      await videoRepo.create({
        id: VIDEO_ID,
        ownerId: '00000000-0000-7000-8000-000000000001',
        title: 'Film Video',
        status: 'READY',
        sourceKey: 'raw/1.mp4',
        categoryId: category.id,
      });

      expect(expectOk(await repo.countVideos(category.id))).toBe(1);

      await videoRepo.transition({
        videoId: VIDEO_ID,
        from: 'READY',
        to: 'DELETED',
        eventType: 'video.deleted',
        patch: { deletedAt: new Date() },
      });

      expect(expectOk(await repo.countVideos(category.id))).toBe(0);
    });

    it('deletes without deciding whether the category was in use', async () => {
      const category = expectOk(await repo.create({ name: 'Film', slug: 'film' }));

      expectOk(await repo.delete(category.id));

      expect(expectOk(await repo.findById(category.id))).toBeNull();
    });
  });

  describe('RedisCategoryCacheAdapter (L1/L2 and Pub/Sub invalidation)', () => {
    let cache: InMemoryCacheClient;
    let service: RedisCategoryCacheAdapter;

    beforeEach(() => {
      cache = new InMemoryCacheClient();
      service = new RedisCategoryCacheAdapter({
        ...CACHES.categories,
        cache,
        l1TtlMs: 1000,
        l2TtlSeconds: 10,
      });
    });

    it('misses the cache on the first call, then serves the same rows from L1', async () => {
      const fetcher = vi.fn().mockResolvedValue(ok([aCategoryRow({ slug: 'tech', name: 'Tech' })]));

      const first = expectOk(await service.getCategories(fetcher));
      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(first).toHaveLength(1);

      const second = expectOk(await service.getCategories(fetcher));
      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(second).toEqual(first);
      expect(service.getL1Size()).toBe(1);
    });

    it('retrieves from L2 when L1 is cleared', async () => {
      const fetcher = vi
        .fn()
        .mockResolvedValue(ok([aCategoryRow({ slug: 'music', name: 'Music' })]));

      const first = expectOk(await service.getCategories(fetcher));
      service.clearL1();
      expect(service.getL1Size()).toBe(0);

      const second = expectOk(await service.getCategories(fetcher));

      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(second).toEqual(first);
      expect(second[0]?.name).toBe('Music');
      expect(service.getL1Size()).toBe(1);
    });

    it('passes the source failure through without caching it', async () => {
      const failure = {
        code: ErrorCodes.DATABASE_UNAVAILABLE,
        message: 'down',
        operation: 'findAll',
      };
      const fetcher = vi.fn().mockResolvedValue({ ok: false, error: failure });

      expect(expectErr(await service.getCategories(fetcher))).toBe(failure);
      expect(service.getL1Size()).toBe(0);
    });

    it('invalidate() clears L1, deletes L2 and broadcasts over Pub/Sub', async () => {
      expectOk(await service.getCategories(vi.fn().mockResolvedValue(ok([]))));
      expect(service.getL1Size()).toBe(1);

      await service.invalidate();

      expect(service.getL1Size()).toBe(0);
      expect(cache.publishedMessages).toHaveLength(1);
      expect(cache.publishedMessages[0]?.channel).toBe(
        'taitube:events:cache:categories:invalidated'
      );
    });

    it('purges a second instance L1 via Pub/Sub when the first invalidates', async () => {
      const instanceA = new RedisCategoryCacheAdapter({ ...CACHES.categories, cache });
      const instanceB = new RedisCategoryCacheAdapter({ ...CACHES.categories, cache });
      expectOk(await instanceB.start());
      const rows = [aCategoryRow()];

      expectOk(await instanceA.getCategories(async () => ok(rows)));
      expectOk(await instanceB.getCategories(async () => ok(rows)));
      expect(instanceA.getL1Size()).toBe(1);
      expect(instanceB.getL1Size()).toBe(1);

      await instanceA.invalidate();

      expect(instanceA.getL1Size()).toBe(0);
      expect(instanceB.getL1Size()).toBe(0);

      await instanceA.close();
      await instanceB.close();
    });
  });
});
