import { type Result, isOk } from '@vp/result';

/**
 * Unwraps a `Result` in a test, failing loudly with the failure that was not expected. Tests read
 * as before the conversion; a surprise failure names itself instead of surfacing as
 * `undefined is not an object` three assertions later.
 */
export function expectOk<T, E>(result: Result<T, E>): T {
  if (!isOk(result)) {
    throw new Error(`Expected ok, got failure: ${JSON.stringify(result.error)}`);
  }
  return result.value;
}

export function expectErr<T, E>(result: Result<T, E>): E {
  if (isOk(result)) {
    throw new Error(`Expected a failure, got ok: ${JSON.stringify(result.value)}`);
  }
  return result.error;
}
