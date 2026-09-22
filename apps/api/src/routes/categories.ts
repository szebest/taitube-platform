import { listCategories } from '@vp/api-contracts';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { CategoryService } from '../services/category-service';
import { contractPaths, contractSchema } from './contract-schema';

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

  for (const { path, hide } of contractPaths(listCategories)) {
    server.get(
      path,
      {
        schema: contractSchema(listCategories, {
          hide,
          responses: { 304: z.undefined().describe('Not Modified') },
        }),
      },
      async (request, reply) => {
        const page = await categoryService.listActive(request.headers['if-none-match']);
        reply.headers(page.headers);
        return page.notModified
          ? reply.status(304).send()
          : reply.status(200).send(page.categories);
      }
    );
  }
}
