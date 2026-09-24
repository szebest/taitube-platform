import { type Result, ok } from '@vp/result';
import {
  Base64UrlCursorCodec,
  type CursorCodec,
  type CursorPayload,
  type InvalidCursor,
} from './cursor-codec';

/**
 * Bounds for a keyset-paginated endpoint. Resolved once at application start
 * from configuration and injected, so no call site hard-codes a page size.
 */
export interface PaginationDefaults {
  readonly defaultLimit: number;
  readonly maxLimit: number;
}

/**
 * `@vp/api-contracts` advertises these on the wire; a deployment configuring `PAGE_SIZE_MAX`
 * lower clamps a request rather than rejecting it.
 */
export const PAGE_SIZE_DEFAULT = 20;
export const PAGE_SIZE_MAX = 100;

export interface PaginatorOptions extends Partial<PaginationDefaults> {
  /** Wire format for cursors; swap it without touching any call site. */
  cursorCodec?: CursorCodec;
}

export interface Page<TItem> {
  items: TItem[];
  nextCursor: string | null;
}

export interface PaginateOptions<TRow, TItem> {
  /** The keyset identifying `row`, which the codec renders as the cursor. */
  cursorOf: (row: TRow) => CursorPayload;
  toItem: (row: TRow) => TItem;
}

/**
 * Keyset pagination over a `limit + 1` row window.
 *
 * Repositories deliberately return one row more than asked for: that extra row
 * is the only evidence a further page exists, and it never reaches the client.
 */
export class Paginator {
  readonly defaults: PaginationDefaults;
  readonly cursorCodec: CursorCodec;

  constructor(options: PaginatorOptions = {}) {
    this.defaults = {
      defaultLimit: options.defaultLimit ?? PAGE_SIZE_DEFAULT,
      maxLimit: options.maxLimit ?? PAGE_SIZE_MAX,
    };
    this.cursorCodec = options.cursorCodec ?? new Base64UrlCursorCodec();
  }

  /** The page size to request, clamped into `[1, maxLimit]`. */
  limit(requested?: number): number {
    if (requested === undefined || !Number.isFinite(requested)) {
      return this.defaults.defaultLimit;
    }
    return Math.max(1, Math.min(this.defaults.maxLimit, Math.trunc(requested)));
  }

  /** The number of rows a repository should fetch to answer `limit`. */
  window(limit: number): number {
    return limit + 1;
  }

  encodeCursor(payload: CursorPayload): string {
    return this.cursorCodec.encode(payload);
  }

  /** An absent cursor is `ok(null)`; a broken one is the only failure this can report. */
  decodeCursor(cursor?: string | null): Result<CursorPayload | null, InvalidCursor> {
    if (!cursor) return ok(null);
    return this.cursorCodec.decode(cursor);
  }

  /** Trims the window to the page and mints the cursor for the next one. */
  paginate<TRow, TItem>(
    rows: TRow[],
    limit: number,
    options: PaginateOptions<TRow, TItem>
  ): Page<TItem> {
    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;
    const last = pageRows[pageRows.length - 1];

    return {
      items: pageRows.map(options.toItem),
      nextCursor: hasMore && last ? this.encodeCursor(options.cursorOf(last)) : null,
    };
  }
}
