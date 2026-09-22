import { ErrorCodes, isInputFailure } from '@vp/errors';
import {
  categoryForbidden,
  categoryInUse,
  categoryNotFound,
  categorySlugConflict,
} from '../failures';

describe('@vp/domain-rules: category failures', () => {
  it.each([
    { name: 'categoryNotFound', failure: categoryNotFound('music'), code: ErrorCodes.CATEGORY_NOT_FOUND },
    {
      name: 'categorySlugConflict',
      failure: categorySlugConflict('music'),
      code: ErrorCodes.CATEGORY_SLUG_CONFLICT,
    },
    { name: 'categoryInUse', failure: categoryInUse('c1', 3), code: ErrorCodes.CATEGORY_IN_USE },
    { name: 'categoryForbidden', failure: categoryForbidden('create'), code: ErrorCodes.FORBIDDEN },
  ])('$name carries $code and stays off the wire', ({ failure, code }) => {
    expect(failure.code).toBe(code);
    expect(isInputFailure(failure)).toBe(false);
  });

  it('reports how many videos still hold the category', () => {
    expect(categoryInUse('c1', 3).videoCount).toBe(3);
  });
});
