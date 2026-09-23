import { err, ok } from '../result';
import { fromPromise, fromThrowable, parseJson, tryCatch } from '../try-catch';

const describeCause = (cause: unknown) => ({ code: 'WRAPPED' as const, cause });

describe('@vp/result: tryCatch', () => {
  it('returns the value when nothing throws', () => {
    expect(tryCatch(() => 'fine', describeCause)).toEqual(ok('fine'));
  });

  it.each([
    { name: 'an Error', thrown: new Error('bang') },
    { name: 'a string', thrown: 'bang' },
    { name: 'undefined', thrown: undefined },
  ])('converts $name into a failure carrying the cause', ({ thrown }) => {
    const result = tryCatch(() => {
      throw thrown;
    }, describeCause);

    expect(result).toEqual(err({ code: 'WRAPPED', cause: thrown }));
  });
});

describe('@vp/result: parseJson', () => {
  it('returns the parsed value of JSON text', () => {
    expect(parseJson('{"a":[1]}')).toEqual(ok({ a: [1] }));
  });

  it.each(['', '{', 'not json'])('returns a SyntaxError for %j instead of throwing', (text) => {
    const parsed = parseJson(text);

    expect(parsed.ok ? undefined : parsed.error).toBeInstanceOf(SyntaxError);
  });
});

describe('@vp/result: fromThrowable', () => {
  it('wraps a function once and forwards its arguments', () => {
    const parse = fromThrowable(JSON.parse, describeCause);

    expect(parse('{"a":1}')).toEqual(ok({ a: 1 }));
  });

  it('returns a failure from the wrapped function instead of throwing', () => {
    const parse = fromThrowable(JSON.parse, () => 'INVALID_JSON');

    expect(parse('{')).toEqual(err('INVALID_JSON'));
  });
});

describe('@vp/result: fromPromise', () => {
  it('returns the resolved value', async () => {
    await expect(fromPromise(Promise.resolve(5), describeCause)).resolves.toEqual(ok(5));
  });

  it.each([
    { name: 'an Error', thrown: new Error('bang') },
    { name: 'a non-Error value', thrown: 'bang' },
  ])('converts a rejection with $name into a failure', async ({ thrown }) => {
    await expect(fromPromise(Promise.reject(thrown), describeCause)).resolves.toEqual(
      err({ code: 'WRAPPED', cause: thrown })
    );
  });

  it('takes a thunk, so the call that builds the promise is inside the boundary', async () => {
    await expect(fromPromise(() => Promise.resolve(5), describeCause)).resolves.toEqual(ok(5));
  });

  it('catches a synchronous throw from a thunk, which a bare promise argument cannot', async () => {
    const thrown = new Error('builder blew up before it returned a promise');

    await expect(
      fromPromise(() => {
        throw thrown;
      }, describeCause)
    ).resolves.toEqual(err({ code: 'WRAPPED', cause: thrown }));
  });
});
