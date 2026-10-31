import { categorySlugConflict, handleTaken, pickWindowOverlap, versionConflict } from '../conflict-failures';
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
      name: 'pickWindowOverlap',
      failure: pickWindowOverlap(new Date(0), new Date(1000)),
      code: ErrorCodes.PICK_WINDOW_OVERLAP,
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

  it('names the window that was refused, as ISO instants', () => {
    expect(pickWindowOverlap(new Date(0), new Date(1000))).toMatchObject({
      startsAt: '1970-01-01T00:00:00.000Z',
      endsAt: '1970-01-01T00:00:01.000Z',
    });
  });

  it('omits the expected version when the caller did not supply one', () => {
    expect(versionConflict('v1')).not.toHaveProperty('expectedVersion');
  });
});
