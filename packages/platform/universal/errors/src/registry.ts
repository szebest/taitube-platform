import { token } from '@kit/di';

export type RetryClass = 'permanent' | 'transient';

/**
 * An app's error vocabulary: every code mapped to its own name, ADR-18's retry class declared once
 * per code, and the code a boundary persists for an error that carries none of them. `retryClass`
 * is a total record, so a code without a class fails to compile.
 */
export interface ErrorCodeSet<C extends string> {
  readonly codes: { readonly [K in C]: K };
  readonly retryClass: Readonly<Record<C, RetryClass>>;
  readonly internal: NoInfer<C>;
}

export function defineErrorCodes<const C extends string>(set: ErrorCodeSet<C>): ErrorCodeSet<C> {
  return Object.freeze({
    codes: Object.freeze(set.codes),
    retryClass: Object.freeze(set.retryClass),
    internal: set.internal,
  });
}

/** The app's `defineErrorCodes` value, provided at its composition root; it has no default. */
export const ErrorCodeRegistry = token<ErrorCodeSet<string>>('ErrorCodeRegistry');

export function isRegisteredCode<C extends string>(set: ErrorCodeSet<C>, code: unknown): code is C {
  return typeof code === 'string' && Object.hasOwn(set.retryClass, code);
}

/** ADR-18's "when unsure, retry a little, then park" applies to anything not in the set. */
export function retryClass<C extends string>(set: ErrorCodeSet<C>, code: string): RetryClass {
  return isRegisteredCode(set, code) ? set.retryClass[code] : 'transient';
}
