import { type Result, err, ok } from '@kit/result';
import { type LengthBounds, normalizePlainText, withinLength } from '@kit/validation';
import { type InvalidField, invalidLength } from '../field-failures';

const TITLE_BOUNDS: LengthBounds = { minLength: 1, maxLength: 100 };
const BODY_BOUNDS: LengthBounds = { minLength: 0, maxLength: 1000 };

export type InvalidThreadContent = InvalidField<LengthBounds>;

export interface ThreadContent {
  title: string;
  body: string;
}

export function validateThreadContent(
  input: ThreadContent
): Result<ThreadContent, InvalidThreadContent> {
  const title = normalizePlainText(input.title);
  if (!withinLength(title, TITLE_BOUNDS)) return err(invalidLength('title', TITLE_BOUNDS));
  const body = normalizePlainText(input.body);
  if (!withinLength(body, BODY_BOUNDS)) return err(invalidLength('body', BODY_BOUNDS));
  return ok({ title, body });
}
