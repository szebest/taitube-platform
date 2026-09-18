import type { CategoryCacheService } from '@vp/adapters';
import type { Repositories } from '@vp/core/ports';
import { ErrorCodes } from '@vp/errors';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { requireAdmin } from '../../plugins/auth';
import {
  CategoryIdParamSchema,
  CategorySchema,
  CreateCategorySchema,
  UpdateCategorySchema,
} from '../../schemas/categories';
import { problemResponse } from '../../schemas/problem';

export interface AdminCategoriesRouteOptions {
  repositories: Repositories;
  categoryCacheService: CategoryCacheService;
}

/**
 * Admin Category CRUD endpoints (Ticket 37, SDD §6.1).
 * Features:
 * - Restricted to administrators (role=admin or x-admin-token)
 * - Automatic multi-tier cache invalidation (L1 LRU + L2 Redis + Pub/Sub cluster broadcast)
 * - Conflict detection on slugs (409) and referenced categories (409)
 */
export function registerAdminCategoriesRoutes(
  app: FastifyInstance,
  options: AdminCategoriesRouteOptions
): void {
  const { repositories, categoryCacheService } = options;
  const server = app.withTypeProvider<ZodTypeProvider>();

  const prefixes = ['/v1/admin/categories', '/admin/categories'] as const;

  for (const prefix of prefixes) {
    const isAlias = prefix === '/admin/categories';

    // 1. POST /v1/admin/categories
    server.post(
      prefix,
      {
        schema: {
          tags: ['Admin'],
          summary: 'Create category',
          description:
            'Creates a new taxonomy category. Automatically invalidates L1/L2 category caches across all pods.',
          body: CreateCategorySchema,
          response: {
            201: CategorySchema,
            400: problemResponse([ErrorCodes.VALIDATION_FAILED], 'Validation error'),
            401: problemResponse([ErrorCodes.UNAUTHORIZED], 'Authentication required'),
            403: problemResponse([ErrorCodes.FORBIDDEN], 'Admin role or token required'),
            409: problemResponse([ErrorCodes.CATEGORY_SLUG_CONFLICT], 'Slug conflict'),
          },
          ...(isAlias ? { hide: true } : {}),
        },
      },
      async (request, reply) => {
        requireAdmin(request);
        const input = request.body;

        const created = await repositories.categories.create(input);
        await categoryCacheService.invalidate();

        return reply.status(201).send(created);
      }
    );

    // 2. PATCH /v1/admin/categories/:id
    server.patch(
      `${prefix}/:id`,
      {
        schema: {
          tags: ['Admin'],
          summary: 'Update category',
          description:
            'Updates existing taxonomy category. Automatically invalidates L1/L2 category caches across all pods.',
          params: CategoryIdParamSchema,
          body: UpdateCategorySchema,
          response: {
            200: CategorySchema,
            400: problemResponse([ErrorCodes.VALIDATION_FAILED], 'Validation error'),
            401: problemResponse([ErrorCodes.UNAUTHORIZED], 'Authentication required'),
            403: problemResponse([ErrorCodes.FORBIDDEN], 'Admin role or token required'),
            404: problemResponse([ErrorCodes.CATEGORY_NOT_FOUND], 'Category not found'),
            409: problemResponse([ErrorCodes.CATEGORY_SLUG_CONFLICT], 'Slug conflict'),
          },
          ...(isAlias ? { hide: true } : {}),
        },
      },
      async (request, reply) => {
        requireAdmin(request);
        const { id } = request.params;
        const input = request.body;

        const updated = await repositories.categories.update(id, input);
        await categoryCacheService.invalidate();

        return reply.status(200).send(updated);
      }
    );

    // 3. DELETE /v1/admin/categories/:id
    server.delete(
      `${prefix}/:id`,
      {
        schema: {
          tags: ['Admin'],
          summary: 'Delete category',
          description:
            'Deletes an unused taxonomy category. Fails with 409 if any videos are associated with it.',
          params: CategoryIdParamSchema,
          response: {
            204: z.undefined().describe('Deleted successfully'),
            401: problemResponse([ErrorCodes.UNAUTHORIZED], 'Authentication required'),
            403: problemResponse([ErrorCodes.FORBIDDEN], 'Admin role or token required'),
            404: problemResponse([ErrorCodes.CATEGORY_NOT_FOUND], 'Category not found'),
            409: problemResponse([ErrorCodes.CATEGORY_IN_USE], 'Category in use by videos'),
          },
          ...(isAlias ? { hide: true } : {}),
        },
      },
      async (request, reply) => {
        requireAdmin(request);
        const { id } = request.params;

        await repositories.categories.delete(id);
        await categoryCacheService.invalidate();

        return reply.status(204).send();
      }
    );
  }
}
