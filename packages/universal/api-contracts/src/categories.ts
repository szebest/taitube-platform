import { z } from 'zod';
import { defineEndpoint } from './endpoint';

export const CategorySchema = z.object({
  id: z.string().uuid().describe('Category unique identifier (UUID)'),
  slug: z.string().describe('Category URL-friendly slug'),
  name: z.string().describe('Category display name'),
  description: z.string().nullable().describe('Optional category description'),
  iconUrl: z.string().nullable().describe('Optional category icon URL'),
  sortOrder: z.number().int().describe('Category display sort order'),
  isActive: z.boolean().describe('Whether category is active and visible to public'),
  createdAt: z.union([z.string(), z.date()]).describe('Creation timestamp'),
  updatedAt: z.union([z.string(), z.date()]).describe('Last update timestamp'),
});

export const CategoriesListSchema = z.array(CategorySchema);

export const CategoryIdParamSchema = z.object({
  id: z.string().uuid().describe('Category UUID'),
});

export const listCategories = defineEndpoint({
  method: 'GET',
  path: '/v1/categories',
  tag: 'Categories',
  summary: 'List active categories',
  description:
    'Public active taxonomy categories list sorted by display sort order and name. Cached with L1/L2 and supports 304 ETag caching.',
  anonymous: true,
  status: 200,
  result: CategoriesListSchema,
  errors: {},
});

export type Category = z.infer<typeof CategorySchema>;
export type CategoriesList = z.infer<typeof CategoriesListSchema>;
export type CategoryIdParam = z.infer<typeof CategoryIdParamSchema>;
