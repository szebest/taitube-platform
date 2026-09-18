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
import { CategoryService } from '../../services/category-service';

export interface AdminCategoriesRouteOptions {
  repositories?: Repositories;
  categoryCacheService?: CategoryCacheService;
  categoryService?: CategoryService;
}

/**
 * Admin Category CRUD endpoints (Ticket 37, SDD §6.1).
 * Thin transport adapter delegating category management and cache invalidation to CategoryService.
 */
export function registerAdminCategoriesRoutes(
  app: FastifyInstance,
  options: AdminCategoriesRouteOptions
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
    throw new Error(
      'registerAdminCategoriesRoutes requires either categoryService or repositories + categoryCacheService'
    );
  }

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
        const created = await categoryService.create(request.body);
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
        const updated = await categoryService.update(id, request.body);
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
        await categoryService.delete(id);
        return reply.status(204).send();
      }
    );
  }
}
