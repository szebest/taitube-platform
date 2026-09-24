import { InMemoryCacheClient } from '@vp/adapters/in-memory';
import { RedisCategoryCacheAdapter } from '@vp/adapters/redis/redis-category-cache.adapter';
import { inProcessAppConfig } from '@vp/env-schema';
import type { FastifyInstance } from 'fastify';
import { ADMIN_TOKEN, type TestApp, bearer, buildTestApp } from './test-app';

export const CATEGORIES_CACHE_CONTROL = 'public, max-age=300, stale-while-revalidate=60';

export interface CategoriesApp extends TestApp {
  categoryCache: RedisCategoryCacheAdapter;
  reset(): void;
}

export function newCategoryCache(cache: InMemoryCacheClient): RedisCategoryCacheAdapter {
  return new RedisCategoryCacheAdapter({ ...inProcessAppConfig().caches.categories, cache });
}

/** `reset()` empties the stores and this instance's in-process category cache between tests. */
export async function buildCategoriesApp(): Promise<CategoriesApp> {
  const cache = new InMemoryCacheClient();
  const categoryCache = newCategoryCache(cache);
  const testApp = await buildTestApp({
    config: inProcessAppConfig({ auth: { adminToken: ADMIN_TOKEN } }),
    adapters: { cache, categoryCache },
  });

  return {
    ...testApp,
    categoryCache,
    reset() {
      testApp.repositories.clear();
      cache.clear();
      categoryCache.clearL1();
    },
  };
}

export function postCategory(
  app: FastifyInstance,
  token: string,
  payload: Record<string, unknown>
) {
  return app.inject({
    method: 'POST',
    url: '/v1/admin/categories',
    headers: bearer(token),
    payload,
  });
}

export function patchCategory(
  app: FastifyInstance,
  token: string,
  id: string,
  payload: Record<string, unknown>
) {
  return app.inject({
    method: 'PATCH',
    url: `/v1/admin/categories/${id}`,
    headers: bearer(token),
    payload,
  });
}

export function deleteCategory(app: FastifyInstance, token: string, id: string) {
  return app.inject({
    method: 'DELETE',
    url: `/v1/admin/categories/${id}`,
    headers: bearer(token),
  });
}
