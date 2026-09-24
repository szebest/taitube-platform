import { type InvalidField, type LengthBounds, invalidField, invalidLength } from '../failures';

export type InvalidSlug = InvalidField<{ slug: string; pattern: string; maxLength: number }>;
export type InvalidCategoryName = InvalidField<LengthBounds>;

export type CategoryFormFailure = InvalidSlug | InvalidCategoryName;

export function invalidSlug(slug: string, pattern: string, maxLength: number): InvalidSlug {
  return invalidField('slug', `Slug must match ${pattern} and be at most ${maxLength} characters`, {
    slug,
    pattern,
    maxLength,
  });
}

export function invalidCategoryName(bounds: LengthBounds): InvalidCategoryName {
  return invalidLength('name', bounds);
}
