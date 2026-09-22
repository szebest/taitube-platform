import { ErrorCodes, type Failure } from '@vp/errors';

export type CategoryNotFound = Failure<
  typeof ErrorCodes.CATEGORY_NOT_FOUND,
  { idOrSlug: string }
>;

export type CategorySlugConflict = Failure<
  typeof ErrorCodes.CATEGORY_SLUG_CONFLICT,
  { slug: string }
>;

export type CategoryInUse = Failure<
  typeof ErrorCodes.CATEGORY_IN_USE,
  { categoryId: string; videoCount: number }
>;

export type CategoryForbidden = Failure<typeof ErrorCodes.FORBIDDEN, { action: string }>;

export function categoryNotFound(idOrSlug: string): CategoryNotFound {
  return { code: ErrorCodes.CATEGORY_NOT_FOUND, message: 'Category not found', idOrSlug };
}

export function categorySlugConflict(slug: string): CategorySlugConflict {
  return {
    code: ErrorCodes.CATEGORY_SLUG_CONFLICT,
    message: `A category with slug "${slug}" already exists`,
    slug,
  };
}

export function categoryInUse(categoryId: string, videoCount: number): CategoryInUse {
  return {
    code: ErrorCodes.CATEGORY_IN_USE,
    message: 'Category still has videos assigned to it',
    categoryId,
    videoCount,
  };
}

export function categoryForbidden(action: string): CategoryForbidden {
  return {
    code: ErrorCodes.FORBIDDEN,
    message: 'Not allowed to manage categories',
    action,
  };
}
