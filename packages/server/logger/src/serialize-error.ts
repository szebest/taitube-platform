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

function serializeAt(value: unknown, depth: number): SerializedError {
  if (!(value instanceof Error)) {
    return { type: typeof value, message: describeNonError(value) };
  }

  const serialized: SerializedError = { type: value.name, message: value.message };
  const code: unknown = Reflect.get(value, 'code');
  if (typeof code === 'string') serialized.code = code;
  if (value.stack) serialized.stack = value.stack;
  if (value.cause !== undefined && depth < MAX_CAUSE_DEPTH) {
    serialized.cause = serializeAt(value.cause, depth + 1);
  }
  return serialized;
}

/**
 * What a log line records for `{ err }`: the message, the code (a `@vp/errors` code, or a system
 * one such as `EADDRINUSE`), the stack and the cause chain. A thrown non-`Error` keeps its content.
 */
export function serializeError(value: unknown): SerializedError {
  return serializeAt(value, 0);
}
