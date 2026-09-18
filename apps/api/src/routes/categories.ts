import type { CategoryCacheService } from '@vp/adapters';
import type { Repositories } from '@vp/core/ports';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { CategoriesListSchema } from '../schemas/categories';
import { CategoryService } from '../services/category-service';

export interface CategoriesRouteOptions {
  repositories?: Repositories;
  categoryCacheService?: CategoryCacheService;
  categoryService?: CategoryService;
}

/**
 * Public categories endpoint (Ticket 37, SDD §6.1).
 * Thin transport adapter delegating domain caching & queries to CategoryService.
 */
export function registerCategoriesRoutes(
  app: FastifyInstance,
  options: CategoriesRouteOptions
): void {
  const categoryService =
    options.categoryService ??
    (options.repositories && options.categoryCacheService
      ? new CategoryService({
          categories: options.repositories.categories,
          categoryCacheService: options.categoryCacheService,
        })
      : undefined);

  if (!categoryService) {
    throw new Error('registerCategoriesRoutes requires either categoryService or repositories + categoryCacheService');
  }

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

        const { categories, etag, isNotModified } = await categoryService.listActive(ifNoneMatch);

        reply.header('Cache-Control', 'public, max-age=300, stale-while-revalidate=60');
        reply.header('ETag', etag);

        if (isNotModified) {
          return reply.status(304).send();
        }

        return reply.status(200).send(categories);
      }
    );
  }
}
