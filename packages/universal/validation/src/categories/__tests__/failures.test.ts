import { ErrorCodes, isInputFailure } from '@vp/errors';
import { invalidCategoryName, invalidSlug } from '../failures';

describe('@vp/validation: category failures', () => {
  it.each([
    { name: 'invalidSlug', failure: invalidSlug('Bad Slug', '^[a-z]+$', 100), field: 'slug' },
    {
      name: 'invalidCategoryName',
      failure: invalidCategoryName({ minLength: 1, maxLength: 100 }),
      field: 'name',
    },
  ])('$name names $field and shares the VALIDATION_FAILED code', ({ failure, field }) => {
    expect(failure.code).toBe(ErrorCodes.VALIDATION_FAILED);
    expect(failure.field).toBe(field);
    expect(isInputFailure(failure)).toBe(true);
  });

  it('carries the rejected slug and the pattern it broke', () => {
    expect(invalidSlug('Bad Slug', '^[a-z]+$', 100)).toMatchObject({
      slug: 'Bad Slug',
      pattern: '^[a-z]+$',
      maxLength: 100,
    });
  });
});
