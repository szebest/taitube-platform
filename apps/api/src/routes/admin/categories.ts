import { createCategory, deleteCategory, updateCategory } from '@vp/api-contracts';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import type { CategoryService } from '../../services/category-service';
import { contractPaths, contractSchema } from '../contract-schema';
import { sendResult } from '../send-result';
import { presentAdminCategoryFailure } from './categories.presenter';

export interface AdminCategoriesRouteOptions {
  categoryService: CategoryService;
}

/**
 * Admin category CRUD (Ticket 37, SDD §6.1). Transport only: it extracts identity, calls the
 * service and hands the `Result` to `sendResult` with the presenter that owns this surface's
 * mapping. No rule, no repository, no status decided by hand.
 */
export function registerAdminCategoriesRoutes(
  app: FastifyInstance,
  options: AdminCategoriesRouteOptions
): void {
  const { categoryService } = options;

  const server = app.withTypeProvider<ZodTypeProvider>();

  for (const { path, hide } of contractPaths(createCategory)) {
    server.post(
      path,
      {
        schema: {
          ...contractSchema(createCategory, { hide }),
          body: createCategory.body,
        },
      },
      async (request, reply) =>
        sendResult(reply, request, await categoryService.create(request.user, request.body), {
          status: 201,
          present: (failure) => presentAdminCategoryFailure(failure, request.url),
        })
    );
  }

  for (const { path, hide } of contractPaths(updateCategory)) {
    server.patch(
      path,
      {
        schema: {
          ...contractSchema(updateCategory, { hide }),
          params: updateCategory.params,
          body: updateCategory.body,
        },
      },
      async (request, reply) =>
        sendResult(
          reply,
          request,
          await categoryService.update(request.user, request.params.id, request.body),
          { present: (failure) => presentAdminCategoryFailure(failure, request.url) }
        )
    );
  }

  for (const { path, hide } of contractPaths(deleteCategory)) {
    server.delete(
      path,
      {
        schema: {
          ...contractSchema(deleteCategory, { hide }),
          params: deleteCategory.params,
        },
      },
      async (request, reply) =>
        sendResult(reply, request, await categoryService.delete(request.user, request.params.id), {
          status: 204,
          present: (failure) => presentAdminCategoryFailure(failure, request.url),
        })
    );
  }
}
