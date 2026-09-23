import { type Result, err, ok } from './result.js';

export function tryCatch<T, E>(fn: () => T, onThrow: (cause: unknown) => E): Result<T, E> {
  try {
    return ok(fn());
  } catch (cause) {
    return err(onThrow(cause));
  }
}

/** `JSON.parse` as a `Result`: text that is not JSON is a failure to answer, not a throw. */
export function parseJson(text: string): Result<unknown, SyntaxError> {
  return tryCatch(
    (): unknown => JSON.parse(text),
    (cause) => cause as SyntaxError
  );
}

export function fromThrowable<A extends readonly unknown[], T, E>(
  fn: (...args: A) => T,
  onThrow: (cause: unknown) => E
): (...args: A) => Result<T, E> {
  return (...args: A) => tryCatch(() => fn(...args), onThrow);
}

/**
 * Pass a thunk whenever the expression that produces the promise can itself throw. An SDK builder
 * chain - `redis.multi().hset(...).exec()` - runs synchronously up to the last call, so handing the
 * finished promise to this function leaves everything before `exec()` outside the boundary.
 */
export async function fromPromise<T, E>(
  promise: PromiseLike<T> | (() => PromiseLike<T>),
  onThrow: (cause: unknown) => E
): Promise<Result<T, E>> {
  try {
    return ok(await (typeof promise === 'function' ? promise() : promise));
  } catch (cause) {
    return err(onThrow(cause));
  }
}
