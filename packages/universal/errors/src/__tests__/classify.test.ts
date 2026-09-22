import { ErrorCodes } from '../error-codes';
import { classifyError, isPermanentError, isTransientError } from '../classify';
import { PermanentError, TransientError } from '../pipeline-error';

describe('@vp/errors: classifyError', () => {
  it.each([
    { name: 'a PermanentError', error: new PermanentError(ErrorCodes.CORRUPT_CONTAINER, 'x'), expected: 'permanent' },
    { name: 'a TransientError', error: new TransientError(ErrorCodes.STORAGE_UNAVAILABLE, 'x'), expected: 'transient' },
  ])('lets $name answer for itself', ({ error, expected }) => {
    expect(classifyError(error)).toBe(expected);
  });

  it('trusts our own class over the code, so a mis-declared throw site stays predictable', () => {
    expect(classifyError(new TransientError(ErrorCodes.CORRUPT_CONTAINER, 'x'))).toBe('transient');
  });

  it.each([
    { name: 'a permanent code', code: ErrorCodes.UNSUPPORTED_CODEC, expected: 'permanent' },
    { name: 'a transient code', code: ErrorCodes.DATABASE_UNAVAILABLE, expected: 'transient' },
  ])('classifies a plain object carrying $name through RETRY_CLASS', ({ code, expected }) => {
    expect(classifyError({ code, message: 'x' })).toBe(expected);
  });

  it("recognises BullMQ's UnrecoverableError by name, the one foreign class we may not import", () => {
    const foreign = new Error('poison');
    foreign.name = 'UnrecoverableError';

    expect(classifyError(foreign)).toBe('permanent');
  });

  it.each([
    { name: 'a bare Error', error: new Error('boom') },
    { name: 'a code the vocabulary does not know', error: { code: 'SOMETHING_NEW' } },
    { name: 'a string', error: 'boom' },
    { name: 'null', error: null },
    { name: 'undefined', error: undefined },
  ])('calls $name unknown rather than guessing', ({ error }) => {
    expect(classifyError(error)).toBe('unknown');
  });

  it('keeps unknown distinct from transient, which is what the lower attempt cap needs', () => {
    expect(isTransientError(new Error('boom'))).toBe(false);
    expect(isPermanentError(new Error('boom'))).toBe(false);
  });
});
