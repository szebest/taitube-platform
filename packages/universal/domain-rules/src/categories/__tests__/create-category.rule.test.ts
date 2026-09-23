import { ErrorCodes } from '@vp/errors';
import { isErr, isOk } from '@vp/result';
import { ADMIN, STRANGER, aCategory } from '../../__tests__/entities';
import { decideCategoryCreate } from '../create-category.rule';

const form = { name: 'Music', slug: 'music', description: null };

describe('@vp/domain-rules: decideCategoryCreate', () => {
  it('accepts a well-formed category from an admin when the slug is free', () => {
    expect(isOk(decideCategoryCreate({ actor: ADMIN, form, slugHeldBy: null }))).toBe(true);
  });

  it.each([
    { name: 'a signed-in user without the role', actor: STRANGER, code: ErrorCodes.FORBIDDEN },
    { name: 'an anonymous caller', actor: null, code: ErrorCodes.UNAUTHORIZED },
  ])('refuses $name before looking at the form, with $code', ({ actor, code }) => {
    const result = decideCategoryCreate({ actor, form: { ...form, slug: '' }, slugHeldBy: null });

    expect(isErr(result) && result.error.code).toBe(code);
  });

  it('rejects a malformed slug before checking for a conflict', () => {
    const result = decideCategoryCreate({
      actor: ADMIN,
      form: { ...form, slug: 'Not A Slug' },
      slugHeldBy: aCategory(),
    });

    expect(isErr(result) && result.error.code).toBe(ErrorCodes.VALIDATION_FAILED);
  });

  it('reports a slug another category already holds', () => {
    const result = decideCategoryCreate({ actor: ADMIN, form, slugHeldBy: aCategory() });

    expect(isErr(result) && result.error.code).toBe(ErrorCodes.CATEGORY_SLUG_CONFLICT);
  });
});
