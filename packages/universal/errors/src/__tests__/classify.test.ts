import { ErrorCodes } from '../error-codes';
import { databaseUnavailable } from '../infra-failures';
import { classifyError, isPermanentError, isTransientError, toPipelineError } from '../classify';
import { PermanentError, TransientError } from '../pipeline-error';

describe('@vp/errors: classifyError', () => {
  it.each([
    {
      name: 'a PermanentError',
      error: new PermanentError(ErrorCodes.CORRUPT_CONTAINER, 'x'),
      expected: 'permanent',
    },
    {
      name: 'a TransientError',
      error: new TransientError(ErrorCodes.STORAGE_UNAVAILABLE, 'x'),
      expected: 'transient',
    },
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

describe('@vp/errors: toPipelineError', () => {
  it.each([
    { code: ErrorCodes.CORRUPT_CONTAINER, Expected: PermanentError, retryable: false },
    { code: ErrorCodes.UNSUPPORTED_CODEC, Expected: PermanentError, retryable: false },
    { code: ErrorCodes.SOURCE_MISSING, Expected: PermanentError, retryable: false },
    { code: ErrorCodes.STORAGE_UNAVAILABLE, Expected: TransientError, retryable: true },
    { code: ErrorCodes.FFMPEG_OOM, Expected: TransientError, retryable: true },
    { code: ErrorCodes.DISK_FULL, Expected: TransientError, retryable: true },
  ])('turns $code into the class RETRY_CLASS names', ({ code, Expected, retryable }) => {
    const thrown = toPipelineError({ code, message: 'boom' });

    expect(thrown).toBeInstanceOf(Expected);
    expect(thrown.isRetryable).toBe(retryable);
    expect(thrown.code).toBe(code);
    expect(thrown.message).toBe('boom');
  });

  it('carries the failure payload into the details, which the DLQ row serialises', () => {
    expect(toPipelineError(databaseUnavailable('findById')).details).toEqual({
      operation: 'findById',
    });
  });

  it('keeps the cause out of the details, which are serialised into the DLQ row', () => {
    const thrown = toPipelineError(databaseUnavailable('findById', new Error('ECONNREFUSED')));

    expect(thrown.details).not.toHaveProperty('cause');
  });

  it('defaults an unknown code to transient, as ADR-18 says', () => {
    expect(toPipelineError({ code: 'SOMETHING_NEW' as never, message: 'x' })).toBeInstanceOf(
      TransientError
    );
  });

  it('round-trips: what it throws, classifyError puts back in the same class', () => {
    expect(classifyError(toPipelineError(databaseUnavailable('findById')))).toBe('transient');
  });
});
