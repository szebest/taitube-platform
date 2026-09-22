import { type Result, err, ok } from '@vp/result';
import { type InvalidSlug, invalidSlug } from './failures.js';

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const SLUG_MAX_LENGTH = 100;

const PATTERN_SOURCE = SLUG_PATTERN.source;

export function validateSlug(slug: string): Result<string, InvalidSlug> {
  return SLUG_PATTERN.test(slug) && slug.length <= SLUG_MAX_LENGTH
    ? ok(slug)
    : err(invalidSlug(slug, PATTERN_SOURCE, SLUG_MAX_LENGTH));
}
