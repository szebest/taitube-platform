import type { Category } from '@vp/domain';
import { type UserContext, canManageCategory } from '@vp/permissions';
import { type Result, err, ok } from '@vp/result';
import {
  type CategoryForbidden,
  type CategoryInUse,
  type CategoryNotFound,
  categoryForbidden,
  categoryInUse,
  categoryNotFound,
} from './failures.js';

export interface DeleteCategoryInput {
  readonly actor: UserContext | null;
  readonly category: Category | null;
  readonly categoryId: string;
  readonly videoCount: number;
}

export type DeleteCategoryFailure = CategoryForbidden | CategoryNotFound | CategoryInUse;

export function decideCategoryDelete(
  input: DeleteCategoryInput
): Result<Category, DeleteCategoryFailure> {
  if (!canManageCategory({ user: input.actor })) return err(categoryForbidden('delete'));
  if (!input.category) return err(categoryNotFound(input.categoryId));
  if (input.videoCount > 0) return err(categoryInUse(input.categoryId, input.videoCount));
  return ok(input.category);
}
