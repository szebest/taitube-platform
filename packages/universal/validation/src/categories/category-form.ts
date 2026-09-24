import { type Result, andThen, err, map, ok } from '@vp/result';
import type { LengthBounds } from '../failures';
import { type CategoryFormFailure, invalidCategoryName } from './failures';
import { validateSlug } from './slug-format';

const CATEGORY_NAME_BOUNDS: LengthBounds = { minLength: 1, maxLength: 100 };

export interface CategoryFormInput {
  readonly name: string;
  readonly slug: string;
  readonly description?: string | null;
}

export function validateCategoryName(name: string): Result<string, CategoryFormFailure> {
  const trimmed = name.trim();
  const { minLength, maxLength } = CATEGORY_NAME_BOUNDS;

  return trimmed.length >= minLength && trimmed.length <= maxLength
    ? ok(trimmed)
    : err(invalidCategoryName(CATEGORY_NAME_BOUNDS));
}

export function validateCategoryForm(
  input: CategoryFormInput
): Result<CategoryFormInput, CategoryFormFailure> {
  return andThen(validateCategoryName(input.name), () =>
    map(validateSlug(input.slug), () => input)
  );
}
