import { ErrorCodes } from '@vp/errors';
import { z } from 'zod';
import { CategoryIdParamSchema, CategorySchema } from './categories';
import { defineEndpoint } from './endpoint';

const SLUG_PATTERN = /^[a-z0-9-]+$/;
const SLUG_MESSAGE = 'Slug must consist of lowercase alphanumeric characters and hyphens';

export const CreateCategorySchema = z.object({
  name: z.string().min(1).max(100).describe('Category display name'),
  slug: z.string().regex(SLUG_PATTERN, SLUG_MESSAGE).max(100).describe('URL-friendly unique slug'),
  description: z.string().max(500).nullish().describe('Optional category description'),
  iconUrl: z.string().max(2000).nullish().describe('Optional icon URL'),
  sortOrder: z.number().int().optional().default(0).describe('Display sort order (default: 0)'),
  isActive: z.boolean().optional().default(true).describe('Active status (default: true)'),
});

export const UpdateCategorySchema = z
  .object({
    name: z.string().min(1).max(100).optional().describe('Category display name'),
    slug: z
      .string()
      .regex(SLUG_PATTERN, SLUG_MESSAGE)
      .max(100)
      .optional()
      .describe('URL-friendly unique slug'),
    description: z.string().max(500).nullish().describe('Optional category description'),
    iconUrl: z.string().max(2000).nullish().describe('Optional icon URL'),
    sortOrder: z.number().int().optional().describe('Display sort order'),
    isActive: z.boolean().optional().describe('Active status'),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update',
  });

export const createCategory = defineEndpoint({
  method: 'POST',
  path: '/v1/admin/categories',
  tag: 'Admin',
  summary: 'Create category',
  description:
    'Creates a new taxonomy category. Automatically invalidates L1/L2 category caches across all pods.',
  body: CreateCategorySchema,
  status: 201,
  result: CategorySchema,
  errors: {
    400: [ErrorCodes.VALIDATION_FAILED],
    401: [ErrorCodes.UNAUTHORIZED],
    403: [ErrorCodes.FORBIDDEN],
    409: [ErrorCodes.CATEGORY_SLUG_CONFLICT],
  },
});

export const updateCategory = defineEndpoint({
  method: 'PATCH',
  path: '/v1/admin/categories/:id',
  tag: 'Admin',
  summary: 'Update category',
  description:
    'Updates existing taxonomy category. Automatically invalidates L1/L2 category caches across all pods.',
  params: CategoryIdParamSchema,
  body: UpdateCategorySchema,
  status: 200,
  result: CategorySchema,
  errors: {
    400: [ErrorCodes.VALIDATION_FAILED],
    401: [ErrorCodes.UNAUTHORIZED],
    403: [ErrorCodes.FORBIDDEN],
    404: [ErrorCodes.CATEGORY_NOT_FOUND],
    409: [ErrorCodes.CATEGORY_SLUG_CONFLICT],
  },
});

export const deleteCategory = defineEndpoint({
  method: 'DELETE',
  path: '/v1/admin/categories/:id',
  tag: 'Admin',
  summary: 'Delete category',
  description:
    'Deletes an unused taxonomy category. Fails with 409 if any videos are associated with it.',
  params: CategoryIdParamSchema,
  status: 204,
  result: z.undefined().describe('Deleted successfully'),
  errors: {
    401: [ErrorCodes.UNAUTHORIZED],
    403: [ErrorCodes.FORBIDDEN],
    404: [ErrorCodes.CATEGORY_NOT_FOUND],
    409: [ErrorCodes.CATEGORY_IN_USE],
  },
});

export type CreateCategory = z.infer<typeof CreateCategorySchema>;
export type UpdateCategory = z.infer<typeof UpdateCategorySchema>;
