import { type Result, err, ok } from '@vp/result';
import type { LengthBounds } from '../failures';
import { normalizePlainText, withinLength } from '../plain-text';
import { type InvalidCommentContent, invalidCommentContent } from './failures';

const COMMENT_CONTENT_BOUNDS: LengthBounds = { minLength: 1, maxLength: 2000 };

export function validateCommentContent(content: string): Result<string, InvalidCommentContent> {
  const normalized = normalizePlainText(content);
  return withinLength(normalized, COMMENT_CONTENT_BOUNDS)
    ? ok(normalized)
    : err(invalidCommentContent(COMMENT_CONTENT_BOUNDS));
}
