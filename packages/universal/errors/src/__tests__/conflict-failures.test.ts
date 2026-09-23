import { categorySlugConflict, handleTaken, versionConflict } from '../conflict-failures';
import { ErrorCodes, isInputFailure } from '../index';

describe('@vp/errors: conflict failures', () => {
  it.each([
    { name: 'handleTaken', failure: handleTaken('ada'), code: ErrorCodes.HANDLE_ALREADY_TAKEN },
    {
      name: 'categorySlugConflict',
      failure: categorySlugConflict('music'),
      code: ErrorCodes.CATEGORY_SLUG_CONFLICT,
    },
    {
      name: 'versionConflict',
      failure: versionConflict('v1', 3),
      code: ErrorCodes.VERSION_CONFLICT,
    },
  ])('$name carries $code and stays off the wire', ({ failure, code }) => {
    expect(failure.code).toBe(code);
    expect(isInputFailure(failure)).toBe(false);
  });

  it('names the value the constraint rejected', () => {
    expect(handleTaken('ada').handle).toBe('ada');
    expect(categorySlugConflict('music').slug).toBe('music');
  });

  it('omits the expected version when the caller did not supply one', () => {
    expect(versionConflict('v1')).not.toHaveProperty('expectedVersion');
  });
});
