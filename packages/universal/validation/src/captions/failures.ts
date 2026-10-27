import { type InvalidField, invalidField } from '../failures';

export type InvalidCaptionLanguage = InvalidField<{ language: string }>;
export type InvalidCaptionFile = InvalidField<{ line: number }>;

export function invalidCaptionLanguage(field: string, language: string): InvalidCaptionLanguage {
  return invalidField(field, `${field} must be a BCP 47 language tag`, { language });
}

/** `line` is 1-based, as a text editor counts. */
export function invalidCaptionFile(line: number, reason: string): InvalidCaptionFile {
  return invalidField('body', `Line ${line}: ${reason}`, { line });
}
