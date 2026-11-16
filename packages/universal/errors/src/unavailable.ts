import type { Failure } from './failure';

/**
 * A dependency that did not answer. `operation` and `cause` are for the server log and never part
 * of `message`, which is what a client may be shown.
 */
export type Unavailable<C extends string> = Failure<C, { operation: string; cause?: unknown }>;

export interface UnavailableFactory<C extends string> {
  (operation: string, cause?: unknown): Unavailable<C>;
  during(operation: string): (cause: unknown) => Unavailable<C>;
}

export function unavailable<C extends string>(code: C, message: string): UnavailableFactory<C> {
  const build = (operation: string, cause?: unknown): Unavailable<C> => ({
    code,
    message,
    operation,
    ...(cause === undefined ? {} : { cause }),
  });
  return Object.assign(build, {
    during: (operation: string) => (cause: unknown) => build(operation, cause),
  });
}
