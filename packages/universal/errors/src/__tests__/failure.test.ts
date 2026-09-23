import { ErrorCodes } from '../error-codes';
import { type AnyFailure, failurePayload, isInputFailure } from '../failure';

const tooLarge = {
  code: ErrorCodes.UPLOAD_TOO_LARGE,
  message: 'File exceeds the upload ceiling',
  field: 'file',
  limitBytes: 5_000_000_000,
} as const;

const unavailable = {
  code: ErrorCodes.DATABASE_UNAVAILABLE,
  message: 'Database unavailable during findById',
  operation: 'findById',
} as const;

describe('@vp/errors: isInputFailure', () => {
  it.each([
    { name: 'an input failure naming a field', failure: tooLarge as AnyFailure, expected: true },
    { name: 'an infra failure', failure: unavailable as AnyFailure, expected: false },
  ])('classifies $name', ({ failure, expected }) => {
    expect(isInputFailure(failure)).toBe(expected);
  });
});

describe('@vp/errors: failurePayload', () => {
  it('keeps the field and the constraint the caller broke', () => {
    expect(failurePayload(tooLarge)).toEqual({ field: 'file', limitBytes: 5_000_000_000 });
  });

  it('drops code, message and cause', () => {
    const payload = failurePayload({ ...tooLarge, cause: new Error('nope') });

    expect(payload).not.toHaveProperty('code');
    expect(payload).not.toHaveProperty('message');
    expect(payload).not.toHaveProperty('cause');
  });

  it('drops a key whose value is undefined', () => {
    expect(failurePayload({ ...tooLarge, allowed: undefined })).not.toHaveProperty('allowed');
  });
});
