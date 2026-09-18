import { CategoryCacheService, InMemoryCacheClient, InMemoryRepositories } from '@vp/adapters';
import { beforeEach, describe, expect, it } from 'vitest';
import { CategoryService } from '../category-service';

describe('CategoryService', () => {
  let repositories: InMemoryRepositories;
  let cacheClient: InMemoryCacheClient;
  let cacheService: CategoryCacheService;
  let categoryService: CategoryService;

  beforeEach(() => {
    repositories = new InMemoryRepositories();
    repositories.clear();
    cacheClient = new InMemoryCacheClient();
    cacheService = new CategoryCacheService({
      cache: cacheClient,
      l1TtlMs: 5000,
      l2TtlSeconds: 300,
    });
    categoryService = new CategoryService({
      categories: repositories.categories,
      categoryCacheService: cacheService,
    });
  });

  it('lists active categories with ETag calculation', async () => {
    await repositories.categories.create({
      slug: 'tech',
      name: 'Technology',
      sortOrder: 10,
    });

    const result = await categoryService.listActive();
    expect(result.categories).toHaveLength(1);
    expect(result.categories[0]?.slug).toBe('tech');
    expect(result.etag).toMatch(/^"?[a-f0-9]{40}"?$/);
    expect(result.isNotModified).toBe(false);
  });

  it('evaluates If-None-Match correctly for 304 not modified', async () => {
    await repositories.categories.create({
      slug: 'tech',
      name: 'Technology',
      sortOrder: 10,
    });

    const first = await categoryService.listActive();
    const second = await categoryService.listActive(first.etag);
    expect(second.isNotModified).toBe(true);
  });

  it('creates category and invalidates multi-tier cache', async () => {
    const created = await categoryService.create({
      slug: 'gaming',
      name: 'Gaming',
      sortOrder: 5,
    });

    expect(created.slug).toBe('gaming');
    const list = await categoryService.listActive();
    expect(list.categories.some((c) => c.slug === 'gaming')).toBe(true);
  });

  it('updates category and invalidates cache', async () => {
    const created = await repositories.categories.create({
      slug: 'music',
      name: 'Music',
      sortOrder: 20,
    });

    const updated = await categoryService.update(created.id, {
      name: 'All Music',
    });

    expect(updated.name).toBe('All Music');
  });

  it('deletes category and invalidates cache', async () => {
    const created = await repositories.categories.create({
      slug: 'news',
      name: 'News',
      sortOrder: 30,
    });

    await categoryService.delete(created.id);
    const list = await categoryService.listActive();
    expect(list.categories.some((c) => c.slug === 'news')).toBe(false);
  });
});
