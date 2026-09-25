import { type Result, err, ok } from '@vp/result';
import { type InvalidField, type LengthBounds, invalidLength } from '../failures';

export const COMMENT_CONTENT_BOUNDS: LengthBounds = { minLength: 1, maxLength: 2000 };

export type InvalidCommentContent = InvalidField<LengthBounds>;

const CONTROL_EXCEPT_LINE_BREAK_AND_TAB = /[^\P{Cc}\n\t]/gu;

/**
 * Content is plain text: markup is kept as typed and escaped wherever it is rendered, because
 * stripping tags here would be a hand-rolled HTML parser. Length counts code points, so an
 * emoji costs one character rather than two UTF-16 units.
 */
export function validateCommentContent(content: string): Result<string, InvalidCommentContent> {
  const normalized = content.replace(CONTROL_EXCEPT_LINE_BREAK_AND_TAB, '').trim();
  const length = Array.from(normalized).length;
  const { minLength, maxLength } = COMMENT_CONTENT_BOUNDS;

  return length >= minLength && length <= maxLength
    ? ok(normalized)
    : err(invalidLength('content', COMMENT_CONTENT_BOUNDS));
}
