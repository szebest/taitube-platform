import { type Result, ok } from './result';

export function map<T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> {
  return result.ok ? ok(fn(result.value)) : result;
}

export function andThen<T, U, E, F>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, F>
): Result<U, E | F> {
  return result.ok ? fn(result.value) : result;
}

export function unwrapOr<T, E>(result: Result<T, E>, fallback: T): T {
  return result.ok ? result.value : fallback;
}

export function all<T, E>(results: readonly Result<T, E>[]): Result<T[], E> {
  const values: T[] = [];
  for (const result of results) {
    if (!result.ok) return result;
    values.push(result.value);
  }
  return ok(values);
}

/** A reason held in a variable could say anything, so only a spelled-out one justifies a drop. */
export type IgnoreReason<S extends string> = string extends S ? never : S extends '' ? never : S;

/**
 * The one sanctioned way to drop a `Result`. `no-discarded-result.test.ts` fails on any other
 * statement that leaves one unread, and reads `reason` to say why this one may be.
 */
export function ignore<S extends string>(
  _result: Result<unknown, unknown> | PromiseLike<Result<unknown, unknown>>,
  _reason: IgnoreReason<S>
): void {}
