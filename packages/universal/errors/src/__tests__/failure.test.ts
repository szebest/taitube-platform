import { type AnyFailure, failurePayload, isInputFailure } from '../failure';

const tooLarge = {
  code: 'TOO_LARGE',
  message: 'File exceeds the upload ceiling',
  field: 'file',
  limitBytes: 5_000_000_000,
} as const;

const unavailable: AnyFailure = {
  code: 'DOWN',
  message: 'Database unavailable during findById',
};

describe('@vp/errors: isInputFailure', () => {
  it.each([
    { name: 'an input failure naming a field', failure: tooLarge, expected: true },
    { name: 'an infra failure', failure: unavailable, expected: false },
  ])('classifies $name', ({ failure, expected }) => {
    expect(isInputFailure(failure)).toBe(expected);
  });
});

describe('@vp/errors: failurePayload', () => {
  it('keeps the field and the constraint the caller broke', () => {
    expect(failurePayload(tooLarge)).toEqual({ field: 'file', limitBytes: 5_000_000_000 });
  });

  it('drops code, message, cause and a key whose value is undefined', () => {
    const payload = failurePayload({ ...tooLarge, cause: new Error('nope'), allowed: undefined });

    expect(payload).toEqual({ field: 'file', limitBytes: 5_000_000_000 });
  });
});
