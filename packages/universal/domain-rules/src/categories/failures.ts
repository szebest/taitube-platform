import { ErrorCodes, type Failure } from '@vp/errors';

export { type CategorySlugConflict, categorySlugConflict } from '@vp/errors';

export type CategoryNotFound = Failure<
  typeof ErrorCodes.CATEGORY_NOT_FOUND,
  { idOrSlug: string }
>;

export type CategoryInUse = Failure<
  typeof ErrorCodes.CATEGORY_IN_USE,
  { categoryId: string; videoCount: number }
>;

export function categoryNotFound(idOrSlug: string): CategoryNotFound {
  return { code: ErrorCodes.CATEGORY_NOT_FOUND, message: 'Category not found', idOrSlug };
}

export function categoryInUse(categoryId: string, videoCount: number): CategoryInUse {
  return {
    code: ErrorCodes.CATEGORY_IN_USE,
    message: 'Category still has videos assigned to it',
    categoryId,
    videoCount,
  };
}

