import type { Category } from '@vp/domain';
import { type UserContext, canManageCategory } from '@vp/permissions';
import { type Result, andThen, err, ok } from '@vp/result';
import { type CategoryFormFailure, validateCategoryName, validateSlug } from '@vp/validation';
import { type AuthorizationFailure, authorize } from '../authorize.js';
import { type CategoryNotFound, categoryNotFound } from './failures.js';

export interface UpdateCategoryRuleInput {
  readonly actor: UserContext | null;
  readonly category: Category | null;
  readonly categoryId: string;
  readonly patch: { readonly name?: string; readonly slug?: string };
}

export type UpdateCategoryFailure =
  | AuthorizationFailure
  | CategoryNotFound
  | CategoryFormFailure;

/**
 * Only the supplied fields are checked. A patch that omits the slug is not a patch with an empty
 * slug, which is the distinction a create rule reused here would lose.
 */
export function decideCategoryUpdate(
  input: UpdateCategoryRuleInput
): Result<Category, UpdateCategoryFailure> {
  return andThen(
    authorize(input.actor, canManageCategory({ user: input.actor }), {
      action: 'update',
      subject: 'Category',
    }),
    (): Result<Category, CategoryNotFound | CategoryFormFailure> => {
      const category = input.category;
      if (!category) return err(categoryNotFound(input.categoryId));

      const named: Result<unknown, CategoryFormFailure> =
        input.patch.name === undefined ? ok(null) : validateCategoryName(input.patch.name);

      return andThen(named, () =>
        input.patch.slug === undefined
          ? ok(category)
          : andThen(validateSlug(input.patch.slug), () => ok(category))
      );
    }
  );
}
