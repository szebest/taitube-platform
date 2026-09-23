import type { Category } from '@vp/domain';
import { type UserContext, canManageCategory } from '@vp/permissions';
import { type Result, andThen, err, ok } from '@vp/result';
import {
  type CategoryFormFailure,
  type CategoryFormInput,
  validateCategoryForm,
} from '@vp/validation';
import { type AuthorizationFailure, authorize } from '../authorize.js';
import { type CategorySlugConflict, categorySlugConflict } from './failures.js';

export interface CreateCategoryInput {
  readonly actor: UserContext | null;
  readonly form: CategoryFormInput;
  /** The category already holding the slug, as a repository read found it. */
  readonly slugHeldBy: Category | null;
}

export type CreateCategoryFailure =
  | AuthorizationFailure
  | CategorySlugConflict
  | CategoryFormFailure;

export function decideCategoryCreate(
  input: CreateCategoryInput
): Result<CategoryFormInput, CreateCategoryFailure> {
  return andThen(
    authorize(input.actor, canManageCategory({ user: input.actor }), {
      action: 'create',
      subject: 'Category',
    }),
    () =>
      andThen(validateCategoryForm(input.form), (form) =>
        input.slugHeldBy ? err(categorySlugConflict(form.slug)) : ok(form)
      )
  );
}
