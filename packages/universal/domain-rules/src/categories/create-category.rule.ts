import type { Category } from '@vp/domain';
import { type UserContext, canManageCategory } from '@vp/permissions';
import { type Result, andThen, err, ok } from '@vp/result';
import { type CategoryFormFailure, type CategoryFormInput, validateCategoryForm } from '@vp/validation';
import {
  type CategoryForbidden,
  type CategorySlugConflict,
  categoryForbidden,
  categorySlugConflict,
} from './failures.js';

export interface CreateCategoryInput {
  readonly actor: UserContext | null;
  readonly form: CategoryFormInput;
  /** The category already holding the slug, as a repository read found it. */
  readonly slugHeldBy: Category | null;
}

export type CreateCategoryFailure =
  | CategoryForbidden
  | CategorySlugConflict
  | CategoryFormFailure;

export function decideCategoryCreate(
  input: CreateCategoryInput
): Result<CategoryFormInput, CreateCategoryFailure> {
  if (!canManageCategory({ user: input.actor })) return err(categoryForbidden('create'));

  return andThen(validateCategoryForm(input.form), (form) =>
    input.slugHeldBy ? err(categorySlugConflict(form.slug)) : ok(form)
  );
}
