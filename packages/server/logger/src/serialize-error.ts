import { CREDENTIAL_HEADERS, REDACTED } from './credentials';

export interface SerializedError {
  type: string;
  message: string;
  code?: string;
  stack?: string;
  cause?: SerializedError;
}

/** A cause chain longer than this is almost always a cycle. */
const MAX_CAUSE_DEPTH = 5;

function withoutCredentials(key: string, value: unknown): unknown {
  return CREDENTIAL_HEADERS.has(key.toLowerCase()) ? REDACTED : value;
}

function describeNonError(value: unknown): string {
  if (typeof value === 'string') return value;
  const json = JSON.stringify(value, withoutCredentials);
  return json ?? String(value);
}

/** A `Failure` from `@vp/errors`: a returned value with a code and a message, not a thrown one. */
interface FailureLike {
  code: string;
  message: string;
  cause?: unknown;
}

function isFailureLike(value: unknown): value is FailureLike {
  if (typeof value !== 'object' || value === null) return false;
  const code: unknown = Reflect.get(value, 'code');
  const message: unknown = Reflect.get(value, 'message');
  return typeof code === 'string' && typeof message === 'string';
}

function withCause(serialized: SerializedError, cause: unknown, depth: number): SerializedError {
  if (cause !== undefined && depth < MAX_CAUSE_DEPTH) {
    serialized.cause = serializeAt(cause, depth + 1);
  }
  return serialized;
}

function serializeAt(value: unknown, depth: number): SerializedError {
  if (value instanceof Error) {
    const serialized: SerializedError = { type: value.name, message: value.message };
    const code: unknown = Reflect.get(value, 'code');
    if (typeof code === 'string') serialized.code = code;
    if (value.stack) serialized.stack = value.stack;
    return withCause(serialized, value.cause, depth);
  }
  if (isFailureLike(value)) {
    const serialized: SerializedError = {
      type: 'Failure',
      message: value.message,
      code: value.code,
    };
    return withCause(serialized, value.cause, depth);
  }
  return { type: typeof value, message: describeNonError(value) };
}

/**
 * What a log line records for `{ err }`: the message, the code (a `@vp/errors` code, or a system
 * one such as `EADDRINUSE`), the stack and the cause chain. A thrown non-`Error` keeps its content.
 */
export function serializeError(value: unknown): SerializedError {
  return serializeAt(value, 0);
}
