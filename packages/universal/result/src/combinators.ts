import { type Result, err, ok } from './result.js';

export function map<T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> {
  return result.ok ? ok(fn(result.value)) : result;
}

export function mapErr<T, E, F>(result: Result<T, E>, fn: (error: E) => F): Result<T, F> {
  return result.ok ? result : err(fn(result.error));
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

export type Coded = { readonly code: string };

export type FailureHandlers<E extends Coded, R> = {
  readonly [C in E['code']]: (failure: Extract<E, { readonly code: C }>) => R;
};

export function match<T, E extends Coded, R>(
  result: Result<T, E>,
  onOk: (value: T) => R,
  onFailure: FailureHandlers<E, R>
): R {
  if (result.ok) return onOk(result.value);
  const handle = onFailure[result.error.code as E['code']] as (failure: E) => R;
  return handle(result.error);
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
