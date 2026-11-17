import { PermanentError, PipelineError, TransientError } from '../pipeline-error';

describe('@vp/errors: queue-boundary error classes', () => {
  it.each([
    { name: 'PermanentError', Klass: PermanentError, isRetryable: false },
    { name: 'TransientError', Klass: TransientError, isRetryable: true },
  ])('$name carries its code, message and retryability', ({ name, Klass, isRetryable }) => {
    const error = new Klass('NOT_FOUND', 'broken', { videoId: 'v1' });

    expect(error).toBeInstanceOf(PipelineError);
    expect(error).toBeInstanceOf(Error);
    expect(error).toMatchObject({
      name,
      code: 'NOT_FOUND',
      message: 'broken',
      details: { videoId: 'v1' },
      isRetryable,
    });
  });

  it('survives an instanceof check across a rethrow', () => {
    const thrown = (() => {
      try {
        throw new TransientError('DOWN', 'down');
      } catch (error) {
        return error;
      }
    })();

    expect(thrown).toBeInstanceOf(TransientError);
  });
});
