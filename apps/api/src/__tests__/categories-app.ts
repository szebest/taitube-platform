import {
  InMemoryCacheClient,
  InMemoryRepositories,
  InMemoryStorageClient,
} from '@vp/adapters/in-memory';
import { RedisCategoryCacheAdapter } from '@vp/adapters/redis/redis-category-cache.adapter';
import { mintToken } from '@vp/dev-token';
import { inProcessAppConfig } from '@vp/env-schema';
import type { FastifyInstance } from 'fastify';
import { composeApp } from '../app';
import { bearer } from './in-memory-app';

export const ADMIN_TOKEN = 'operator-token-for-tests';
export const REGULAR_USER_ID = '00000000-0000-7000-8000-000000000001';
export const CATEGORIES_CACHE_CONTROL = 'public, max-age=300, stale-while-revalidate=60';

const ADMIN_USER_ID = '00000000-0000-7000-8000-000000000003';
const CACHES = inProcessAppConfig().caches;

export interface CategoriesApp {
  app: FastifyInstance;
  repositories: InMemoryRepositories;
  cache: InMemoryCacheClient;
  storage: InMemoryStorageClient;
  categoryCache: RedisCategoryCacheAdapter;
  adminJwt: string;
  userJwt: string;
  reset(): void;
}

export function newCategoryCache(cache: InMemoryCacheClient): RedisCategoryCacheAdapter {
  return new RedisCategoryCacheAdapter({ ...CACHES.categories, cache });
}

export async function buildCategoriesApp(): Promise<CategoriesApp> {
  const repositories = new InMemoryRepositories();
  const cache = new InMemoryCacheClient();
  const storage = new InMemoryStorageClient();
  const categoryCache = newCategoryCache(cache);
  const app = (
    await composeApp({
      config: inProcessAppConfig({ auth: { adminToken: ADMIN_TOKEN } }),
      adapters: { repositories, cache, storage, categoryCache },
    })
  ).app;

  return {
    app,
    repositories,
    cache,
    storage,
    categoryCache,
    adminJwt: mintToken({ sub: ADMIN_USER_ID, role: 'admin', ttl: '1h' }),
    userJwt: mintToken({ sub: REGULAR_USER_ID, role: 'user', ttl: '1h' }),
    reset() {
      repositories.clear();
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
