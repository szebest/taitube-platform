import { type Result, err, ok } from './result.js';

export function tryCatch<T, E>(fn: () => T, onThrow: (cause: unknown) => E): Result<T, E> {
  try {
    return ok(fn());
  } catch (cause) {
    return err(onThrow(cause));
  }
}

export function fromThrowable<A extends readonly unknown[], T, E>(
  fn: (...args: A) => T,
  onThrow: (cause: unknown) => E
): (...args: A) => Result<T, E> {
  return (...args: A) => tryCatch(() => fn(...args), onThrow);
}

export async function fromPromise<T, E>(
  promise: PromiseLike<T>,
  onThrow: (cause: unknown) => E
): Promise<Result<T, E>> {
  try {
    return ok(await promise);
  } catch (cause) {
    return err(onThrow(cause));
  }
}
