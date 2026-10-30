import { type Result, err, isErr, isOk, ok } from '../result';

describe('@vp/result: constructors and guards', () => {
  it('wraps a value as a success', () => {
    expect(ok(42)).toEqual({ ok: true, value: 42 });
  });

  it('carries undefined for a valueless success', () => {
    expect(ok()).toEqual({ ok: true, value: undefined });
  });

  it('wraps an error as a failure', () => {
    expect(err('boom')).toEqual({ ok: false, error: 'boom' });
  });

  it.each([
    { name: 'a success', result: ok(1) as Result<number, string>, isOkExpected: true },
    { name: 'a failure', result: err('nope') as Result<number, string>, isOkExpected: false },
  ])('reports $name consistently through both guards', ({ result, isOkExpected }) => {
    expect(isOk(result)).toBe(isOkExpected);
    expect(isErr(result)).toBe(!isOkExpected);
  });

  it('narrows to the value through isOk', () => {
    const result: Result<number, string> = ok(7);
    if (!isOk(result)) throw new Error('expected a success');

    expect(result.value.toFixed(1)).toBe('7.0');
  });

  it('narrows to the error through isErr', () => {
    const result: Result<number, string> = err('nope');
    if (!isErr(result)) throw new Error('expected a failure');

    expect(result.error.toUpperCase()).toBe('NOPE');
  });

  it('treats a falsy value as a success', () => {
    expect(isOk(ok(0))).toBe(true);
    expect(isOk(ok(null))).toBe(true);
  });
});
