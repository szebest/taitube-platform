import { type Result, err, ok } from '@kit/result';
import { type LengthBounds, normalizePlainText, withinLength } from '@kit/validation';
import { type InvalidField, invalidLength } from '../field-failures';

const CLIP_TITLE_BOUNDS: LengthBounds = { minLength: 1, maxLength: 100 };

export type InvalidClipTitle = InvalidField<LengthBounds>;

export function validateClipTitle(title: string): Result<string, InvalidClipTitle> {
  const text = normalizePlainText(title);
  return withinLength(text, CLIP_TITLE_BOUNDS)
    ? ok(text)
    : err(invalidLength('title', CLIP_TITLE_BOUNDS));
}
