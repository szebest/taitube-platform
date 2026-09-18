import {
  CategoryCacheService,
  InMemoryCacheClient,
  InMemoryCategoryRepository,
  InMemoryVideoRepository,
} from '@vp/adapters';
import type { Category } from '@vp/core/repositories';
import { ErrorCodes, PermanentError } from '@vp/errors';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('Category Repositories & L1/L2 Cache Service (Ticket 37)', () => {
  describe('InMemoryCategoryRepository', () => {
    let repo: InMemoryCategoryRepository;
    let videoRepo: InMemoryVideoRepository;

    beforeEach(() => {
      videoRepo = new InMemoryVideoRepository();
      repo = new InMemoryCategoryRepository({ videosRepo: videoRepo });
    });

    it('creates category with default sortOrder and isActive', async () => {
      const cat = await repo.create({
        name: 'Technology',
        slug: 'tech',
        description: 'Tech videos',
      });

      expect(cat.id).toBeDefined();
      expect(cat.name).toBe('Technology');
      expect(cat.slug).toBe('tech');
      expect(cat.description).toBe('Tech videos');
      expect(cat.sortOrder).toBe(0);
      expect(cat.isActive).toBe(true);
      expect(cat.createdAt).toBeInstanceOf(Date);
      expect(cat.updatedAt).toBeInstanceOf(Date);
    });

    it('rejects duplicate slug with CATEGORY_SLUG_CONFLICT', async () => {
      await repo.create({ name: 'Tech 1', slug: 'tech' });
      await expect(repo.create({ name: 'Tech 2', slug: 'tech' })).rejects.toThrowError(
        PermanentError
      );

      try {
        await repo.create({ name: 'Tech 2', slug: 'tech' });
      } catch (err) {
        expect((err as PermanentError).code).toBe(ErrorCodes.CATEGORY_SLUG_CONFLICT);
      }
    });

    it('finds by ID and by Slug', async () => {
      const created = await repo.create({ name: 'Gaming', slug: 'gaming' });
      const byId = await repo.findById(created.id);
      expect(byId).toEqual(created);

      const bySlug = await repo.findBySlug('gaming');
      expect(bySlug).toEqual(created);

      expect(await repo.findById('non-existent')).toBeNull();
      expect(await repo.findBySlug('non-existent')).toBeNull();
    });

    it('findAll sorts by sortOrder ASC, name ASC, and filters activeOnly', async () => {
      await repo.create({ name: 'Zebra', slug: 'zebra', sortOrder: 1, isActive: true });
      await repo.create({ name: 'Apple', slug: 'apple', sortOrder: 1, isActive: true });
      await repo.create({ name: 'Beta', slug: 'beta', sortOrder: 0, isActive: true });
      await repo.create({ name: 'Inactive', slug: 'inactive', sortOrder: 0, isActive: false });

      const all = await repo.findAll();
      expect(all.map((c) => c.slug)).toEqual(['beta', 'inactive', 'apple', 'zebra']);

      const activeOnly = await repo.findAll({ activeOnly: true });
      expect(activeOnly.map((c) => c.slug)).toEqual(['beta', 'apple', 'zebra']);
    });

    it('updates category fields and checks slug uniqueness', async () => {
      const cat1 = await repo.create({ name: 'Original', slug: 'orig' });
      const cat2 = await repo.create({ name: 'Other', slug: 'other' });
      expect(cat2.id).toBeDefined();

      const updated = await repo.update(cat1.id, { name: 'Renamed', sortOrder: 5 });
      expect(updated.name).toBe('Renamed');
      expect(updated.sortOrder).toBe(5);

      // Conflict when changing slug to another existing category
      await expect(repo.update(cat1.id, { slug: 'other' })).rejects.toThrowError(PermanentError);

      // Non-existent category
      await expect(repo.update('non-existent', { name: 'Fail' })).rejects.toThrowError(
        PermanentError
      );
    });

    it('deletes category when not in use, but rejects CATEGORY_IN_USE when referenced by videos', async () => {
      const cat = await repo.create({ name: 'Film', slug: 'film' });

      // Associate a video with this category
      await videoRepo.create({
        id: '018f0000-0000-7000-8000-000000000001',
        ownerId: '00000000-0000-7000-8000-000000000001',
        title: 'Film Video',
        status: 'READY',
        sourceKey: 'raw/1.mp4',
        categoryId: cat.id,
      });

      await expect(repo.delete(cat.id)).rejects.toThrowError(PermanentError);
      try {
        await repo.delete(cat.id);
      } catch (err) {
        expect((err as PermanentError).code).toBe(ErrorCodes.CATEGORY_IN_USE);
      }

      // Soft delete the video
      await videoRepo.transition({
        videoId: '018f0000-0000-7000-8000-000000000001',
        from: 'READY',
        to: 'DELETED',
        eventType: 'video.deleted',
        patch: { deletedAt: new Date() },
      });

      // Now deletion succeeds
      await repo.delete(cat.id);
      expect(await repo.findById(cat.id)).toBeNull();
    });
  });

  describe('CategoryCacheService (L1/L2 and Pub/Sub invalidation)', () => {
    let cache: InMemoryCacheClient;
    let service: CategoryCacheService;

    beforeEach(() => {
      cache = new InMemoryCacheClient();
      service = new CategoryCacheService({ cache, l1TtlMs: 1000, l2TtlSeconds: 10 });
    });

    it('misses cache on first call, populates L1 and L2, and returns ETag', async () => {
      const fetcher = vi.fn().mockResolvedValue([
        {
          id: '1',
          name: 'Tech',
          slug: 'tech',
          description: null,
          iconUrl: null,
          sortOrder: 0,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const result = await service.getCategories(fetcher);
      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(result.categories).toHaveLength(1);
      expect(result.etag).toMatch(/^"[a-f0-9]{40}"$/);

      // L1 hit on subsequent call
      const l1Result = await service.getCategories(fetcher);
      expect(fetcher).toHaveBeenCalledTimes(1); // Not called again
      expect(l1Result.etag).toBe(result.etag);
      expect(service.getL1Size()).toBe(1);
    });

    it('retrieves from L2 Redis cache when L1 is cleared', async () => {
      const fetcher = vi.fn().mockResolvedValue([
        {
          id: '1',
          name: 'Music',
          slug: 'music',
          description: null,
          iconUrl: null,
          sortOrder: 0,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const res1 = await service.getCategories(fetcher);
      expect(fetcher).toHaveBeenCalledTimes(1);

      // Clear L1 only
      service.clearL1();
      expect(service.getL1Size()).toBe(0);

      // Call again: should hit L2 Redis cache and re-populate L1 without calling fetcher
      const res2 = await service.getCategories(fetcher);
      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(res2.etag).toBe(res1.etag);
      expect(res2.categories[0]?.name).toBe('Music');
      expect(service.getL1Size()).toBe(1);
    });

    it('invalidate() clears L1, deletes L2, and broadcasts over Pub/Sub', async () => {
      const fetcher = vi.fn().mockResolvedValue([]);
      await service.getCategories(fetcher);
      expect(service.getL1Size()).toBe(1);

      await service.invalidate();
      expect(service.getL1Size()).toBe(0);

      // Pub/Sub message published
      expect(cache.publishedMessages).toHaveLength(1);
      expect(cache.publishedMessages[0]?.channel).toBe(
        'taitube:events:cache:categories:invalidated'
      );
    });

    it('multi-instance test: invalidation on Instance A purges L1 on Instance B via Pub/Sub', async () => {
      // Create second instance sharing the same cache client
      const instanceA = new CategoryCacheService({ cache });
      const instanceB = new CategoryCacheService({ cache });

      const sampleCategories: Category[] = [
        {
          id: 'cat-1',
          slug: 'art',
          name: 'Art',
          description: null,
          iconUrl: null,
          sortOrder: 0,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      // Both instances populate their L1 caches
      await instanceA.getCategories(async () => sampleCategories);
      await instanceB.getCategories(async () => sampleCategories);

      expect(instanceA.getL1Size()).toBe(1);
      expect(instanceB.getL1Size()).toBe(1);

      // Instance A mutates and invalidates
      await instanceA.invalidate();

      // Instance B's L1 cache is purged immediately via Pub/Sub!
      expect(instanceA.getL1Size()).toBe(0);
      expect(instanceB.getL1Size()).toBe(0);

      instanceA.close();
      instanceB.close();
    });
  });
});
