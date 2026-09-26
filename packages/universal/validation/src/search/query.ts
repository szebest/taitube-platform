import { type Result, err, ok } from '@vp/result';
import { type InvalidField, type LengthBounds, invalidLength } from '../failures';
import { withinLength } from '../plain-text';

export const SEARCH_QUERY_BOUNDS: LengthBounds = { minLength: 1, maxLength: 100 };

export type InvalidSearchQuery = InvalidField<LengthBounds>;

/**
 * Trimmed, whitespace collapsed and lowercased before the bounds apply, so `Linus`, `linus ` and
 * `LINUS` are one query to the cache, the suggestion index and the ranking.
 */
export function validateSearchQuery(q: string): Result<string, InvalidSearchQuery> {
  const text = q.trim().replace(/\s+/g, ' ').toLowerCase();
  return withinLength(text, SEARCH_QUERY_BOUNDS)
    ? ok(text)
    : err(invalidLength('q', SEARCH_QUERY_BOUNDS));
}
