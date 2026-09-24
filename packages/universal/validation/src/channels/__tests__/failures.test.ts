import { ErrorCodes, isInputFailure } from '@vp/errors';
import { invalidHandleFormat } from '../failures';

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

  it('reports a wire-safe failure', () => {
    expect(isInputFailure(invalidHandleFormat('a', bounds))).toBe(true);
  });
});
