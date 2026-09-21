import { listCategories } from '@vp/api-contracts';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { CategoryService } from '../services/category-service';
import { contractSchema } from './contract-schema';

export interface CategoriesRouteOptions {
  categoryService: CategoryService;
}

/**
 * Public categories endpoint (Ticket 37, SDD §6.1).
 * Thin transport adapter delegating domain caching & queries to CategoryService.
 */
export function registerCategoriesRoutes(
  app: FastifyInstance,
  options: CategoriesRouteOptions
): void {
  const { categoryService } = options;

  const server = app.withTypeProvider<ZodTypeProvider>();

  for (const path of ['/v1/categories', '/categories'] as const) {
    server.get(
      path,
      {
        schema: contractSchema(listCategories, {
          hide: path === '/categories',
          responses: { 304: z.undefined().describe('Not Modified') },
        }),
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
