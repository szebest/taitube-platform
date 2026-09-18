import type { CategoryCacheService } from '@vp/adapters';
import type { Repositories } from '@vp/core/ports';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { CategoriesListSchema } from '../schemas/categories';

export interface CategoriesRouteOptions {
  repositories: Repositories;
  categoryCacheService: CategoryCacheService;
}

/**
 * Public categories endpoint (Ticket 37, SDD §6.1).
 * Features:
 * - Unauthenticated taxonomy list sorted by sort_order ASC, name ASC
 * - L1/L2 multi-tier caching (LRU + Redis)
 * - Deterministic ETag and Cache-Control (max-age=300, stale-while-revalidate=60)
 * - 304 Not Modified conditional requests with zero database round-trips
 */
export function registerCategoriesRoutes(
  app: FastifyInstance,
  options: CategoriesRouteOptions
): void {
  const { repositories, categoryCacheService } = options;
  const server = app.withTypeProvider<ZodTypeProvider>();

  for (const path of ['/v1/categories', '/categories'] as const) {
    const isAlias = path === '/categories';
    server.get(
      path,
      {
        schema: {
          tags: ['Categories'],
          summary: 'List active categories',
          description:
            'Public active taxonomy categories list sorted by display sort order and name. Cached with L1/L2 and supports 304 ETag caching.',
          security: [],
          response: {
            200: CategoriesListSchema,
            304: z.undefined().describe('Not Modified'),
          },
          ...(isAlias ? { hide: true } : {}),
        },
      },
      async (request, reply) => {
        const ifNoneMatch = request.headers['if-none-match'];

        const { categories, etag } = await categoryCacheService.getCategories(() =>
          repositories.categories.findAll({ activeOnly: true })
        );

        reply.header('Cache-Control', 'public, max-age=300, stale-while-revalidate=60');
        reply.header('ETag', etag);

        if (
          ifNoneMatch &&
          (ifNoneMatch === etag ||
            ifNoneMatch === etag.replace(/^W\//, '') ||
            ifNoneMatch === `"${etag.replace(/^W\/"?|"?$/g, '')}"`)
        ) {
          return reply.status(304).send();
        }

        return reply.status(200).send(categories);
      }
    );
  }
}
