import { andThenAsync } from '../async';
import { type Result, err, ok } from '../result';

describe('@vp/result: andThenAsync', () => {
  it('chains a success into the awaited next result', async () => {
    await expect(andThenAsync(ok(2), async (n) => ok(n + 1))).resolves.toEqual(ok(3));
  });

  it('accepts a promised result as its input', async () => {
    await expect(andThenAsync(Promise.resolve(ok(2)), (n) => ok(n + 1))).resolves.toEqual(ok(3));
  });

  it('short-circuits a failure without awaiting the next step', async () => {
    const next = vi.fn(async () => ok(1));

    await expect(andThenAsync(err('nope') as Result<number, string>, next)).resolves.toEqual(
      err('nope')
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('widens the error union across an awaited chain', async () => {
    const chained: Result<number, 'A' | 'B'> = await andThenAsync(
      ok(1) as Result<number, 'A'>,
      async (): Promise<Result<number, 'B'>> => err('B')
    );

    expect(chained).toEqual(err('B'));
  });
});
