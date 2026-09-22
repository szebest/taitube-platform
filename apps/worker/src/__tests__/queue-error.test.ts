import { ErrorCodes, PermanentError, TransientError, databaseUnavailable } from '@vp/errors';
import { err, ok } from '@vp/result';
import { failedResult, toQueueError } from '../queue-error';

describe('toQueueError', () => {
  it.each([
    { code: ErrorCodes.CORRUPT_CONTAINER, Expected: PermanentError, retryable: false },
    { code: ErrorCodes.UNSUPPORTED_CODEC, Expected: PermanentError, retryable: false },
    { code: ErrorCodes.SOURCE_MISSING, Expected: PermanentError, retryable: false },
    { code: ErrorCodes.STORAGE_UNAVAILABLE, Expected: TransientError, retryable: true },
    { code: ErrorCodes.FFMPEG_OOM, Expected: TransientError, retryable: true },
    { code: ErrorCodes.DISK_FULL, Expected: TransientError, retryable: true },
  ])('turns $code into the class RETRY_CLASS names', ({ code, Expected, retryable }) => {
    const queued = toQueueError({ code, message: 'boom' });

    expect(queued).toBeInstanceOf(Expected);
    expect(queued.isRetryable).toBe(retryable);
    expect(queued.code).toBe(code);
    expect(queued.message).toBe('boom');
  });

  it('carries the failure payload into the DLQ details', () => {
    const queued = toQueueError(databaseUnavailable('findById'));

    expect(queued.details).toEqual({ operation: 'findById' });
  });

  it('keeps the cause out of the details, which are serialised into the DLQ row', () => {
    const queued = toQueueError(databaseUnavailable('findById', new Error('ECONNREFUSED')));

    expect(queued.details).not.toHaveProperty('cause');
  });

  it('defaults an unknown code to transient, as ADR-18 says', () => {
    expect(toQueueError({ code: 'SOMETHING_NEW' as never, message: 'x' })).toBeInstanceOf(
      TransientError
    );
  });
});

describe('failedResult', () => {
  it('recognises a failed Result a converted stage returned', () => {
    expect(failedResult(err(databaseUnavailable('findById')))).toBe(true);
  });

  it.each([
    { name: 'a successful Result', outcome: ok({ videoId: 'v1' }) },
    { name: 'a plain stage return value', outcome: { videoId: 'v1', published: true } },
    { name: 'undefined', outcome: undefined },
    { name: 'null', outcome: null },
    { name: 'a string', outcome: 'done' },
    { name: 'a failure-shaped object with no code', outcome: { ok: false, error: {} } },
  ])('does not mistake $name for one', ({ outcome }) => {
    expect(failedResult(outcome)).toBe(false);
  });
});
