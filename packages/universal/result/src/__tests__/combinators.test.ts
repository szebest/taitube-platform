import { all, andThen, map, mapErr, match, unwrapOr } from '../combinators';
import { type Result, err, ok } from '../result';

type Boom = { readonly code: 'BOOM'; readonly at: string };
type Gone = { readonly code: 'GONE' };
type Failure = Boom | Gone;

const boom: Boom = { code: 'BOOM', at: 'here' };
const gone: Gone = { code: 'GONE' };

describe('@vp/result: synchronous combinators', () => {
  it('maps the value of a success', () => {
    expect(map(ok(2), (n) => n * 3)).toEqual(ok(6));
  });

  it('leaves a failure untouched when mapping the value', () => {
    expect(map(err('nope') as Result<number, string>, (n) => n * 3)).toEqual(err('nope'));
  });

  it('maps the error of a failure', () => {
    expect(mapErr(err('nope'), (e) => e.length)).toEqual(err(4));
  });

  it('leaves a success untouched when mapping the error', () => {
    expect(mapErr(ok(2) as Result<number, string>, (e) => e.length)).toEqual(ok(2));
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

describe('@vp/result: match', () => {
  const handlers = {
    BOOM: (failure: Boom) => `boom at ${failure.at}`,
    GONE: () => 'gone',
  };

  it('applies the success handler to a value', () => {
    expect(match(ok(3) as Result<number, Failure>, (n) => `got ${n}`, handlers)).toBe('got 3');
  });

  it.each([
    { name: 'BOOM', failure: boom as Failure, expected: 'boom at here' },
    { name: 'GONE', failure: gone as Failure, expected: 'gone' },
  ])('routes $name to its own handler with the narrowed payload', ({ failure, expected }) => {
    expect(match(err(failure) as Result<number, Failure>, () => 'unused', handlers)).toBe(expected);
  });
});
