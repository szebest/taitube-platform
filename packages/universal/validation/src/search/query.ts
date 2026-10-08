import { type Result, err, ok } from '@vp/result';
import { type InvalidField, type LengthBounds, invalidField, invalidLength } from '../failures';
import { withinLength } from '../plain-text';

const SEARCH_QUERY_BOUNDS: LengthBounds = { minLength: 1, maxLength: 100 };

const WORDLIKE = /[\p{L}\p{N}]/u;
const PLAIN_WORD = /^[\p{L}\p{M}\p{N}]+$/u;

export type InvalidSearchQuery = InvalidField<LengthBounds> | InvalidField;

/** The query parses to nothing that narrows a search, as `-lofi` or `-"lo fi"` does. */
export function searchQueryWithoutTerms(): InvalidField {
  return invalidField('q', 'q must hold at least one word to search for', {});
}

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
  return words(text).some(isPositiveTerm) ? ok(text) : err(searchQueryWithoutTerms());
}

/**
 * Letters and digits only, so `react`, `react!` and `react?.` cannot become three suggestions of
 * one search, and no quote, `or` or exclusion reaches the index.
 */
export function isPlainSearchQuery(text: string): boolean {
  return words(text).every((word) => word !== 'or' && PLAIN_WORD.test(word));
}
