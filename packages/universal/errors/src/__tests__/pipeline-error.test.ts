import { ErrorCodes } from '../error-codes';
import { PermanentError, PipelineError, TransientError } from '../pipeline-error';

describe('@vp/errors: queue-boundary error classes', () => {
  it.each([
    { name: 'PermanentError', Klass: PermanentError, isRetryable: false },
    { name: 'TransientError', Klass: TransientError, isRetryable: true },
  ])('$name carries its code, message and retryability', ({ name, Klass, isRetryable }) => {
    const error = new Klass(ErrorCodes.CORRUPT_CONTAINER, 'broken', { videoId: 'v1' });

    expect(error).toBeInstanceOf(PipelineError);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe(name);
    expect(error.code).toBe(ErrorCodes.CORRUPT_CONTAINER);
    expect(error.message).toBe('broken');
    expect(error.details).toEqual({ videoId: 'v1' });
    expect(error.isRetryable).toBe(isRetryable);
  });

  it('survives an instanceof check across a rethrow', () => {
    const thrown = (() => {
      try {
        throw new TransientError(ErrorCodes.STORAGE_UNAVAILABLE, 'down');
      } catch (error) {
        return error;
      }
    })();

    expect(thrown).toBeInstanceOf(TransientError);
  });
});
