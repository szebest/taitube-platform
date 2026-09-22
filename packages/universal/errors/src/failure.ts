import type { ErrorCode } from './error-codes.js';

export type Failure<C extends ErrorCode, D extends object = Record<never, never>> = Readonly<
  { code: C; message: string } & D
>;

/**
 * A failure that repeats only what the caller already sent - the field, the rejected value, the
 * limit it broke. Wire safety is this type, not a per-field judgement at each call site: an input
 * failure names a field, and nothing that reads an entity or an adapter can.
 */
export type InputFailure<C extends ErrorCode, D extends object = Record<never, never>> = Failure<
  C,
  { field: string } & D
>;

export interface AnyFailure {
  readonly code: ErrorCode;
  readonly message: string;
}

export interface AnyInputFailure extends AnyFailure {
  readonly field: string;
}

export function isInputFailure(failure: AnyFailure): failure is AnyInputFailure {
  return typeof (failure as Partial<AnyInputFailure>).field === 'string';
}

const OFF_THE_WIRE = new Set(['code', 'message', 'cause']);

export function failurePayload<F extends AnyInputFailure>(failure: F): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(failure).filter(([key, value]) => !OFF_THE_WIRE.has(key) && value !== undefined)
  );
}
