import { asThrowable, attemptsFor, classifyError, errorCodeOf, toPipelineError } from '../classify';
import { PermanentError, TransientError } from '../pipeline-error';
import { unavailable } from '../unavailable';
import { codes } from './fixtures';

const down = unavailable('DOWN', 'Store unavailable');

describe('@vp/errors: classifyError', () => {
  it.each([
    {
      name: 'a PermanentError',
      error: new PermanentError('NOT_FOUND', 'x'),
      expected: 'permanent',
    },
    { name: 'a TransientError', error: new TransientError('DOWN', 'x'), expected: 'transient' },
  ])('lets $name answer for itself', ({ error, expected }) => {
    expect(classifyError(codes, error)).toBe(expected);
  });

  it('trusts our own class over the code, so a mis-declared throw site stays predictable', () => {
    expect(classifyError(codes, new TransientError('NOT_FOUND', 'x'))).toBe('transient');
  });

  it.each([
    { name: 'a permanent code', code: 'NOT_FOUND', expected: 'permanent' },
    { name: 'a transient code', code: 'DOWN', expected: 'transient' },
  ])('classifies a plain object carrying $name through the set', ({ code, expected }) => {
    expect(classifyError(codes, { code, message: 'x' })).toBe(expected);
  });

  it("recognises BullMQ's UnrecoverableError by name, the one foreign class we may not import", () => {
    const foreign = new Error('poison');
    foreign.name = 'UnrecoverableError';

    expect(classifyError(codes, foreign)).toBe('permanent');
  });

  it.each([
    { name: 'a bare Error', error: new Error('boom') },
    { name: 'a code the set does not know', error: { code: 'SOMETHING_NEW' } },
    { name: 'a string', error: 'boom' },
    { name: 'null', error: null },
    { name: 'undefined', error: undefined },
  ])('calls $name unknown rather than guessing', ({ error }) => {
    expect(classifyError(codes, error)).toBe('unknown');
  });
});

describe('@vp/errors: attemptsFor', () => {
  it.each([
    {
      name: 'a permanent error',
      error: new PermanentError('NOT_FOUND', 'x'),
      allowed: 5,
      expected: 1,
    },
    { name: 'a transient error', error: new TransientError('DOWN', 'x'), allowed: 5, expected: 5 },
    {
      name: 'an unknown error under a larger policy',
      error: new Error('boom'),
      allowed: 5,
      expected: 3,
    },
    {
      name: 'an unknown error under a smaller policy',
      error: new Error('boom'),
      allowed: 2,
      expected: 2,
    },
  ])('gives $name $expected of $allowed attempts', ({ error, allowed, expected }) => {
    expect(attemptsFor(codes, error, allowed)).toBe(expected);
  });
});

describe('@vp/errors: toPipelineError', () => {
  it.each([
    { code: 'NOT_FOUND', Expected: PermanentError, retryable: false },
    { code: 'DOWN', Expected: TransientError, retryable: true },
    { code: 'SOMETHING_NEW', Expected: TransientError, retryable: true },
  ])('turns $code into the class its retry class names', ({ code, Expected, retryable }) => {
    const thrown = toPipelineError(codes, { code, message: 'boom' });

    expect(thrown).toBeInstanceOf(Expected);
    expect(thrown).toMatchObject({ isRetryable: retryable, code, message: 'boom' });
  });

  it('carries the payload into the details, which the DLQ row serialises, and never the cause', () => {
    const thrown = toPipelineError(codes, down('findById', new Error('ECONNREFUSED')));

    expect(thrown.details).toEqual({ operation: 'findById' });
  });

  it('round-trips: what it throws, classifyError puts back in the same class', () => {
    expect(classifyError(codes, toPipelineError(codes, down('findById')))).toBe('transient');
  });
});

describe('@vp/errors: errorCodeOf', () => {
  it.each([
    { shape: 'a pipeline error', error: new PermanentError('NOT_FOUND', 'x') },
    {
      shape: 'a wrapped cause',
      error: new Error('job failed', { cause: new TransientError('NOT_FOUND', 'x') }),
    },
  ])('keeps the registered code carried by $shape', ({ error }) => {
    expect(errorCodeOf(codes, error)).toBe('NOT_FOUND');
  });

  it.each([
    { shape: 'a plain error', error: new Error('boom') },
    {
      shape: 'a code outside the set',
      error: Object.assign(new Error('x'), { code: 'ECONNRESET' }),
    },
    { shape: 'nothing at all', error: undefined },
  ])("persists the set's internal code for $shape", ({ error }) => {
    expect(errorCodeOf(codes, error)).toBe('INTERNAL');
  });
});

describe('@vp/errors: asThrowable', () => {
  it('keeps an Error it was handed, EADDRINUSE included', () => {
    const bound = Object.assign(new Error('listen EADDRINUSE'), { code: 'EADDRINUSE' });

    expect(asThrowable(codes, bound)).toBe(bound);
  });

  it.each([
    {
      shape: 'with its message',
      cause: { code: 'DOWN', message: 'Store unavailable' },
      message: 'Store unavailable',
    },
    { shape: 'without a message', cause: { code: 'DOWN' }, message: 'DOWN' },
  ])('raises a registered failure $shape through its retry class', ({ cause, message }) => {
    const thrown = asThrowable(codes, cause);

    expect(thrown).toBeInstanceOf(TransientError);
    expect(thrown).toMatchObject({ code: 'DOWN', message });
  });

  it('wraps anything else in a plain Error', () => {
    expect(asThrowable(codes, 'down')).toEqual(new Error('down'));
  });
});
