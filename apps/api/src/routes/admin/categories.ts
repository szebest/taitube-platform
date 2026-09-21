import { createCategory, deleteCategory, updateCategory } from '@vp/api-contracts';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import type { CategoryService } from '../../services/category-service';
import { contractSchema } from '../contract-schema';

export interface AdminCategoriesRouteOptions {
  categoryService: CategoryService;
}

/**
 * Admin Category CRUD endpoints (Ticket 37, SDD §6.1).
 * Thin transport adapter delegating category management and cache invalidation to CategoryService.
 */
export function registerAdminCategoriesRoutes(
  app: FastifyInstance,
  options: AdminCategoriesRouteOptions
): void {
  const { categoryService } = options;

  const server = app.withTypeProvider<ZodTypeProvider>();

  const prefixes = ['/v1/admin/categories', '/admin/categories'] as const;

  for (const prefix of prefixes) {
    const isAlias = prefix === '/admin/categories';

    server.post(
      prefix,
      {
        schema: {
          ...contractSchema(createCategory, { hide: isAlias }),
          body: createCategory.body,
        },
      },
      async (request, reply) => {
        const created = await categoryService.create(request.user, request.body);
        return reply.status(201).send(created);
      }
    );

    server.patch(
      `${prefix}/:id`,
      {
        schema: {
          ...contractSchema(updateCategory, { hide: isAlias }),
          params: updateCategory.params,
          body: updateCategory.body,
        },
      },
      async (request, reply) => {
        const { id } = request.params;
        const updated = await categoryService.update(request.user, id, request.body);
        return reply.status(200).send(updated);
      }
    );

    server.delete(
      `${prefix}/:id`,
      {
        schema: {
          ...contractSchema(deleteCategory, { hide: isAlias }),
          params: deleteCategory.params,
        },
      },
      async (request, reply) => {
        const { id } = request.params;
        await categoryService.delete(request.user, id);
        return reply.status(204).send();
      }
    );
  }
}
