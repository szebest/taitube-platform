/**
 * The keyset a cursor carries: the sort key and tiebreaker of the last row on
 * a page. Deliberately flat so any codec can render it.
 */
export type CursorPayload = Record<string, string | number>;

export class InvalidCursorError extends Error {
  constructor(message = 'Invalid pagination cursor') {
    super(message);
    this.name = 'InvalidCursorError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Wire format for a keyset cursor. Implementations are interchangeable: a
 * service names the keyset, the codec decides how it travels over HTTP.
 */
export interface CursorCodec {
  encode(payload: CursorPayload): string;
  decode(cursor: string): CursorPayload;
}

function assertPayload(parsed: unknown): CursorPayload {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new InvalidCursorError();
  }
  return parsed as CursorPayload;
}

/** Readable JSON, useful in tests and when debugging a paginated endpoint. */
export class JsonCursorCodec implements CursorCodec {
  encode(payload: CursorPayload): string {
    return JSON.stringify(payload);
  }

  decode(cursor: string): CursorPayload {
    try {
      return assertPayload(JSON.parse(cursor));
    } catch {
      throw new InvalidCursorError();
    }
  }
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

  decode(cursor: string): CursorPayload {
    try {
      const base64 = cursor.replace(/-/g, '+').replace(/_/g, '/');
      const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='));
      const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
      return assertPayload(JSON.parse(new TextDecoder().decode(bytes)));
    } catch {
      throw new InvalidCursorError();
    }
  }
}

export const defaultCursorCodec: CursorCodec = new Base64UrlCursorCodec();
