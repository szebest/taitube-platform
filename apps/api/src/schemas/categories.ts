import { z } from 'zod';

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

export type CategoryType = z.infer<typeof CategorySchema>;

export const CategoriesListSchema = z.array(CategorySchema);

export const CreateCategorySchema = z.object({
  name: z.string().min(1).max(100).describe('Category display name'),
  slug: z
    .string()
    .regex(/^[a-z0-9-]+$/, 'Slug must consist of lowercase alphanumeric characters and hyphens')
    .max(100)
    .describe('URL-friendly unique slug'),
  description: z.string().max(500).nullish().describe('Optional category description'),
  iconUrl: z.string().max(2000).nullish().describe('Optional icon URL'),
  sortOrder: z.number().int().optional().default(0).describe('Display sort order (default: 0)'),
  isActive: z.boolean().optional().default(true).describe('Active status (default: true)'),
});

export type CreateCategoryType = z.infer<typeof CreateCategorySchema>;

export const UpdateCategorySchema = z
  .object({
    name: z.string().min(1).max(100).optional().describe('Category display name'),
    slug: z
      .string()
      .regex(/^[a-z0-9-]+$/, 'Slug must consist of lowercase alphanumeric characters and hyphens')
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

export type UpdateCategoryType = z.infer<typeof UpdateCategorySchema>;

export const CategoryIdParamSchema = z.object({
  id: z.string().uuid().describe('Category UUID'),
});

export type CategoryIdParamType = z.infer<typeof CategoryIdParamSchema>;
