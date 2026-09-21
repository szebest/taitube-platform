import { Singleflight } from '../singleflight';

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (e: Error) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (e: Error) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('Singleflight', () => {
  let singleflight: Singleflight;

  beforeEach(() => {
    singleflight = new Singleflight();
  });

  it('runs the work once for concurrent callers on the same key', async () => {
    const gate = deferred<string>();
    let calls = 0;
    const run = () =>
      singleflight.do('key', () => {
        calls += 1;
        return gate.promise;
      });

    const [a, b] = [run(), run()];
    expect(singleflight.inFlightCount).toBe(1);

    gate.resolve('value');
    expect(await a).toBe('value');
    expect(await b).toBe('value');
    expect(calls).toBe(1);
  });

  it('keeps separate keys apart', async () => {
    const seen: string[] = [];
    await Promise.all([
      singleflight.do('a', async () => void seen.push('a')),
      singleflight.do('b', async () => void seen.push('b')),
    ]);

    expect(seen.sort()).toEqual(['a', 'b']);
  });

  it('releases the key once the work settles, so the next call runs again', async () => {
    let calls = 0;
    const run = () =>
      singleflight.do('key', async () => {
        calls += 1;
        return calls;
      });

    expect(await run()).toBe(1);
    expect(singleflight.inFlightCount).toBe(0);
    expect(await run()).toBe(2);
  });

  it('releases the key after a rejection and propagates it to every caller', async () => {
    const gate = deferred<string>();
    const run = () => singleflight.do('key', () => gate.promise);

    const [a, b] = [run(), run()];
    gate.reject(new Error('boom'));

    await expect(a).rejects.toThrow('boom');
    await expect(b).rejects.toThrow('boom');
    expect(singleflight.inFlightCount).toBe(0);
  });

  it('forgets the in-flight work on clear', async () => {
    const gate = deferred<string>();
    const first = singleflight.do('key', () => gate.promise);
    singleflight.clear();
    expect(singleflight.inFlightCount).toBe(0);

    const second = singleflight.do('key', async () => 'second');
    gate.resolve('first');

    expect(await first).toBe('first');
    expect(await second).toBe('second');
  });
});
