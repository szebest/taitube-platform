import type { InputFailure } from '@kit/errors';
import { type Result, err, ok, tryCatch } from '@kit/result';

/** The codes this package emits; an app spreads them into its error code set. */
export const PaginationErrorCodes = {
  INVALID_CURSOR: 'INVALID_CURSOR',
} as const;

/**
 * The keyset a cursor carries: the sort key and tiebreaker of the last row on
 * a page. Deliberately flat so any codec can render it.
 */
export type CursorPayload = Record<string, string | number>;

/**
 * An input failure: it repeats only what the caller sent, so it is wire-safe by construction and
 * `problemFor` may project it into `Problem.errors`.
 */
export type InvalidCursor = InputFailure<typeof PaginationErrorCodes.INVALID_CURSOR>;

export function invalidCursor(field = 'cursor'): InvalidCursor {
  return {
    code: PaginationErrorCodes.INVALID_CURSOR,
    message: PaginationErrorCodes.INVALID_CURSOR,
    field,
  };
}

/**
 * Wire format for a keyset cursor. Implementations are interchangeable: a
 * service names the keyset, the codec decides how it travels over HTTP.
 */
export interface CursorCodec {
  encode(payload: CursorPayload): string;
  decode(cursor: string): Result<CursorPayload, InvalidCursor>;
}

const isPayload = (value: object): value is CursorPayload =>
  Object.values(value).every((entry) => typeof entry === 'string' || typeof entry === 'number');

function asPayload(parsed: unknown): Result<CursorPayload, InvalidCursor> {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || !isPayload(parsed)) {
    return err(invalidCursor());
  }
  return ok(parsed);
}

/**
 * Default wire format: base64url JSON, opaque enough that clients treat the
 * cursor as a token. Uses `btoa`/`atob` rather than `Buffer` so the codec runs
 * unchanged under Node, Bun and the browser.
 */
export class Base64UrlCursorCodec implements CursorCodec {
  encode(payload: CursorPayload): string {
    const binary = String.fromCharCode(...new TextEncoder().encode(JSON.stringify(payload)));
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  decode(cursor: string): Result<CursorPayload, InvalidCursor> {
    const parsed = tryCatch(
      () => {
        const base64 = cursor.replace(/-/g, '+').replace(/_/g, '/');
        const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='));
        const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
        return JSON.parse(new TextDecoder().decode(bytes));
      },
      () => invalidCursor()
    );

    return parsed.ok ? asPayload(parsed.value) : parsed;
  }
}
