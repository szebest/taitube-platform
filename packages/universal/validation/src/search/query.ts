import { type Result, err, ok } from '@vp/result';
import { type InvalidField, type LengthBounds, invalidField, invalidLength } from '../failures';
import { withinLength } from '../plain-text';

const SEARCH_QUERY_BOUNDS: LengthBounds = { minLength: 1, maxLength: 100 };

const WORDLIKE = /[\p{L}\p{N}]/u;

export type InvalidSearchQuery = InvalidField<LengthBounds> | InvalidField;

function words(text: string): string[] {
  return text.split(' ');
}

/** A word `websearch_to_tsquery` matches on, rather than an `or`, a `-` exclusion or punctuation. */
function isPositiveTerm(word: string): boolean {
  return word !== 'or' && !word.startsWith('-') && WORDLIKE.test(word);
}

/**
 * Trimmed, whitespace collapsed and lowercased before the bounds apply, so `Linus`, `linus ` and
 * `LINUS` are one query to the cache, the suggestion index and the ranking. A query of exclusions
 * alone, `-lofi`, would match nearly everything, so it is refused.
 */
export function validateSearchQuery(q: string): Result<string, InvalidSearchQuery> {
  const text = q.trim().replace(/\s+/g, ' ').toLowerCase();
  if (!withinLength(text, SEARCH_QUERY_BOUNDS)) return err(invalidLength('q', SEARCH_QUERY_BOUNDS));
  return words(text).some(isPositiveTerm)
    ? ok(text)
    : err(invalidField('q', 'q must hold at least one word to search for', {}));
}

/** Plain words only: no phrase quotes, no `or`, no exclusions. Only such a query is worth suggesting. */
export function isPlainSearchQuery(text: string): boolean {
  return !text.includes('"') && words(text).every(isPositiveTerm);
}
