import { all, andThen, ignore, map, unwrapOr } from '../combinators';
import { type Result, err, ok } from '../result';

type Boom = { readonly code: 'BOOM'; readonly at: string };
type Gone = { readonly code: 'GONE' };

const boom: Boom = { code: 'BOOM', at: 'here' };
const gone: Gone = { code: 'GONE' };

describe('@vp/result: synchronous combinators', () => {
  it('maps the value of a success', () => {
    expect(map(ok(2), (n) => n * 3)).toEqual(ok(6));
  });

  it('leaves a failure untouched when mapping the value', () => {
    expect(map(err('nope') as Result<number, string>, (n) => n * 3)).toEqual(err('nope'));
  });

  it('chains a success into the next result', () => {
    expect(andThen(ok(2), (n) => ok(n + 1))).toEqual(ok(3));
  });

  it('short-circuits a failure without calling the next step', () => {
    const next = vi.fn(() => ok(1));

    expect(andThen(err('nope') as Result<number, string>, next)).toEqual(err('nope'));
    expect(next).not.toHaveBeenCalled();
  });

  it('widens the error union across a chain', () => {
    const chained: Result<number, Boom | Gone> = andThen(
      ok(1) as Result<number, Boom>,
      (): Result<number, Gone> => err(gone)
    );

    expect(chained).toEqual(err(gone));
  });

  it.each([
    { name: 'a success', result: ok(9) as Result<number, string>, expected: 9 },
    { name: 'a failure', result: err('nope') as Result<number, string>, expected: -1 },
  ])('unwraps $name against the fallback', ({ result, expected }) => {
    expect(unwrapOr(result, -1)).toBe(expected);
  });
});

describe('@vp/result: all', () => {
  it('collects every value in order', () => {
    expect(all([ok(1), ok(2), ok(3)])).toEqual(ok([1, 2, 3]));
  });

  it('returns the first failure and stops', () => {
    expect(all([ok(1), err('first'), err('second')] as Result<number, string>[])).toEqual(
      err('first')
    );
  });

  it('collects nothing from an empty list', () => {
    expect(all([])).toEqual(ok([]));
  });
});

describe('@vp/result: ignore', () => {
  it.each([
    { shape: 'a settled failure', result: err(gone) },
    { shape: 'a settled success', result: ok(1) },
    { shape: 'a pending result', result: Promise.resolve(err(boom)) },
  ])('drops $shape and returns nothing', ({ result }) => {
    expect(ignore(result, 'the cache is advisory')).toBeUndefined();
  });
});
