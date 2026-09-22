import { assertNever } from '../../assert-never';
import { match } from '../../combinators';
import { type Result, isErr, isOk } from '../../result';

type Known = { readonly code: 'A'; readonly at: string } | { readonly code: 'B' };
type Grown = Known | { readonly code: 'C' };

export function renderKnown(failure: Known): string {
  switch (failure.code) {
    case 'A':
      return failure.at;
    case 'B':
      return 'b';
    default:
      return assertNever(failure, 'renderKnown');
  }
}

export function renderGrown(failure: Grown): string {
  switch (failure.code) {
    case 'A':
      return failure.at;
    case 'B':
      return 'b';
    default:
      // @ts-expect-error 'C' still reaches the default branch, so `failure` is not `never`
      return assertNever(failure, 'renderGrown');
  }
}

const knownHandlers = { A: (f: { readonly at: string }) => f.at, B: () => 'b' };

export function matchKnown(result: Result<number, Known>): string {
  return match(result, () => 'ok', knownHandlers);
}

export function matchGrown(result: Result<number, Grown>): string {
  // @ts-expect-error the handler record has no entry for the 'C' variant
  return match(result, () => 'ok', knownHandlers);
}

export function narrowsToValue(result: Result<number, Known>): number {
  return isOk(result) ? result.value : 0;
}

export function narrowsToError(result: Result<number, Known>): string {
  return isErr(result) ? result.error.code : 'ok';
}

export function doesNotReachTheErrorOfASuccess(result: Result<number, Known>): string {
  if (isOk(result)) {
    // @ts-expect-error a narrowed success has no `error` property
    return result.error.code;
  }
  return 'err';
}
