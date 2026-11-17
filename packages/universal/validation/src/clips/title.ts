import { type Result, err, ok } from '@kit/result';
import type { LengthBounds } from '../failures';
import { type InvalidField, invalidLength } from '../field-failures';
import { normalizePlainText, withinLength } from '../plain-text';

const CLIP_TITLE_BOUNDS: LengthBounds = { minLength: 1, maxLength: 100 };

export type InvalidClipTitle = InvalidField<LengthBounds>;

export function validateClipTitle(title: string): Result<string, InvalidClipTitle> {
  const text = normalizePlainText(title);
  return withinLength(text, CLIP_TITLE_BOUNDS)
    ? ok(text)
    : err(invalidLength('title', CLIP_TITLE_BOUNDS));
}
