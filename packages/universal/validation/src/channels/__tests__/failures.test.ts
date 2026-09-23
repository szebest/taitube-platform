import { ErrorCodes, isInputFailure } from '@vp/errors';
import { invalidDisplayName, invalidHandleFormat } from '../failures';

const bounds = { minLength: 3, maxLength: 30 };

describe('@vp/validation: channel failures', () => {
  it('reports a malformed handle with its bounds', () => {
    expect(invalidHandleFormat('a', bounds)).toMatchObject({
      code: ErrorCodes.INVALID_HANDLE_FORMAT,
      field: 'handle',
      handle: 'a',
      minLength: 3,
      maxLength: 30,
      reserved: false,
    });
  });

  it('distinguishes a reserved handle from a malformed one', () => {
    const reserved = invalidHandleFormat('admin', bounds, true);

    expect(reserved.reserved).toBe(true);
    expect(reserved.message).toBe('Handle "admin" is reserved');
  });

  it.each([
    { name: 'invalidHandleFormat', failure: invalidHandleFormat('a', bounds) },
    { name: 'invalidDisplayName', failure: invalidDisplayName({ minLength: 1, maxLength: 100 }) },
  ])('$name is wire-safe', ({ failure }) => {
    expect(isInputFailure(failure)).toBe(true);
  });
});
