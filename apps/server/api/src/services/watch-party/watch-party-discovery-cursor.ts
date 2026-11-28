import {
  type CursorPayload,
  type InvalidCursor,
  type Paginator,
  invalidCursor,
} from '@kit/pagination';
import { type Result, andThen, err, map, ok } from '@kit/result';
import type { SearchMode, WatchPartyDiscoveryPosition, WatchPartyDiscoverySort } from '@vp/domain';
import { z } from 'zod';
import { asDate, decodeWith, isoOf } from '../cursor';

/** The last millisecond of 9999: past it `toISOString()` writes `+011476-...`, which Postgres refuses. */
const LAST_FOUR_DIGIT_YEAR_MS = Date.UTC(9999, 11, 31, 23, 59, 59, 999);
const MAX_INT = 2 ** 31 - 1;
const MODES: readonly SearchMode[] = ['lexical', 'fuzzy'];
const UuidSchema = z.uuid();

export interface DiscoveryWalk {
  readonly position: WatchPartyDiscoveryPosition;
  readonly mode: SearchMode;
}

/** Names its sort, and the match mode the walk began in, so a page resumes where the first one looked. */
export function discoveryCursorPayload(
  position: WatchPartyDiscoveryPosition,
  mode: SearchMode
): CursorPayload {
  const key = typeof position.key === 'number' ? position.key : isoOf(position.key);
  return { sort: position.sort, mode, key, id: position.id };
}

function asMode(value: unknown): Result<SearchMode, InvalidCursor> {
  const mode = MODES.find((candidate) => candidate === value);
  return mode === undefined ? err(invalidCursor()) : ok(mode);
}

function asUuid(value: unknown): Result<string, InvalidCursor> {
  const parsed = UuidSchema.safeParse(value);
  return parsed.success ? ok(parsed.data) : err(invalidCursor());
}

function asCount(value: unknown): Result<number, InvalidCursor> {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= MAX_INT
    ? ok(value)
    : err(invalidCursor());
}

function asScore(value: unknown): Result<number, InvalidCursor> {
  return typeof value === 'number' && Number.isFinite(value) ? ok(value) : err(invalidCursor());
}

function asInstant(value: unknown): Result<Date, InvalidCursor> {
  return andThen(asDate(value), (date) =>
    date.getTime() >= 0 && date.getTime() <= LAST_FOUR_DIGIT_YEAR_MS
      ? ok(date)
      : err(invalidCursor())
  );
}

function positionOf(
  sort: WatchPartyDiscoverySort,
  key: unknown,
  id: string
): Result<WatchPartyDiscoveryPosition, InvalidCursor> {
  switch (sort) {
    case 'members':
      return map(asCount(key), (value) => ({ sort, key: value, id }));
    case 'trending':
      return map(asScore(key), (value) => ({ sort, key: value, id }));
    case 'newest':
    case 'starting_soon':
      return map(asInstant(key), (value) => ({ sort, key: value, id }));
  }
}

/** Refused under another sort: a member count resumes nothing in a walk ordered by age. */
export function decodeDiscoveryCursor(
  cursor: string | undefined,
  sort: WatchPartyDiscoverySort,
  paginator: Paginator
): Result<DiscoveryWalk | null, InvalidCursor> {
  return decodeWith(cursor, paginator, (payload) => {
    if (payload['sort'] !== sort) return err(invalidCursor());
    return andThen(asMode(payload['mode']), (mode) =>
      andThen(asUuid(payload['id']), (id) =>
        map(positionOf(sort, payload['key'], id), (position) => ({ position, mode }))
      )
    );
  });
}
