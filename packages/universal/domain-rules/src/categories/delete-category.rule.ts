import type { Category } from '@vp/domain';
import { type UserContext, canManageCategory } from '@vp/permissions';
import { type Result, andThen, err, ok } from '@vp/result';
import { type AuthorizationFailure, authorize } from '../authorize';
import {
  type CategoryInUse,
  type CategoryNotFound,
  categoryInUse,
  categoryNotFound,
} from './failures';

export interface DeleteCategoryInput {
  readonly actor: UserContext | null;
  readonly category: Category | null;
  readonly categoryId: string;
  readonly videoCount: number;
}

export type DeleteCategoryFailure = AuthorizationFailure | CategoryNotFound | CategoryInUse;

export function decideCategoryDelete(
  input: DeleteCategoryInput
): Result<Category, DeleteCategoryFailure> {
  return andThen(
    authorize(input.actor, canManageCategory({ user: input.actor }), {
      action: 'delete',
      subject: 'Category',
    }),
    (): Result<Category, CategoryNotFound | CategoryInUse> => {
      if (!input.category) return err(categoryNotFound(input.categoryId));
      if (input.videoCount > 0) return err(categoryInUse(input.categoryId, input.videoCount));
      return ok(input.category);
    }
  );
}
