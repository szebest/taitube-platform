import { type Result, err, ok } from '@kit/result';
import { type LengthBounds, normalizePlainText, withinLength } from '@kit/validation';
import { type InvalidReportNote, invalidReportNote } from './failures';

const REPORT_NOTE_BOUNDS: LengthBounds = { minLength: 1, maxLength: 500 };

/** The note is optional: a blank one is no note, not a rejected one. */
export function validateReportNote(
  note: string | undefined
): Result<string | null, InvalidReportNote> {
  const normalized = normalizePlainText(note ?? '');
  if (normalized === '') return ok(null);
  return withinLength(normalized, REPORT_NOTE_BOUNDS)
    ? ok(normalized)
    : err(invalidReportNote(REPORT_NOTE_BOUNDS));
}
