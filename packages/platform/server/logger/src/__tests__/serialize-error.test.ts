import { serializeError } from '../serialize-error';

describe('@vp/logger: serializeError', () => {
  it('keeps the message, the pipeline code and the whole cause chain', () => {
    const root = Object.assign(new TypeError('bucket did not answer'), {
      code: 'STORAGE_UNAVAILABLE',
    });
    const wrapped = new Error('upload failed', { cause: new Error('put failed', { cause: root }) });

    const serialized = serializeError(wrapped);

    expect(serialized).toMatchObject({
      type: 'Error',
      message: 'upload failed',
      cause: {
        message: 'put failed',
        cause: { type: 'TypeError', code: 'STORAGE_UNAVAILABLE', message: 'bucket did not answer' },
      },
    });
    expect(serialized.stack).toContain('upload failed');
  });

  it('reads a returned Failure as its code, message and cause', () => {
    const failure = {
      code: 'STORAGE_UNAVAILABLE',
      message: 'put failed',
      cause: new Error('ECONNRESET'),
    };

    expect(serializeError(failure)).toMatchObject({
      type: 'Failure',
      code: 'STORAGE_UNAVAILABLE',
      message: 'put failed',
      cause: { type: 'Error', message: 'ECONNRESET' },
    });
  });

  it.each([
    ['a string', 'disk full', 'disk full'],
    ['an object', { status: 'X', reason: 'y' }, '{"status":"X","reason":"y"}'],
    ['undefined', undefined, 'undefined'],
  ])('keeps the content of %s that was thrown instead of an Error', (_name, thrown, message) => {
    expect(serializeError(thrown)).toEqual({ type: typeof thrown, message });
  });

  it('stops following a cause chain that loops', () => {
    const looped = new Error('a');
    looped.cause = looped;

    let depth = 0;
    for (let cause = serializeError(looped).cause; cause; cause = cause.cause) depth += 1;

    expect(depth).toBe(5);
  });
});
