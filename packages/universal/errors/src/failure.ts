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

const OFF_THE_WIRE: ReadonlySet<string> = new Set(['code', 'message', 'cause']);

/**
 * Everything a failure carries beyond the three fields every failure has. Widely typed because
 * the throw boundary attaches it to an `Error` for diagnosis; `failurePayload` is the narrow door
 * that decides what reaches a client.
 */
export function failureDetails(failure: AnyFailure): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(failure).filter(([key, value]) => !OFF_THE_WIRE.has(key) && value !== undefined)
  );
}

/**
 * The wire projection. It takes an `AnyInputFailure` and nothing else, so a state-rule or infra
 * payload cannot reach a response body by mistake - the compiler refuses it rather than a
 * reviewer having to notice.
 */
export function failurePayload<F extends AnyInputFailure>(failure: F): Record<string, unknown> {
  return failureDetails(failure);
}
