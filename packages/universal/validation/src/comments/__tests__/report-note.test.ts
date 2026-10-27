import { ErrorCodes } from '@vp/errors';
import { isErr, isOk } from '@vp/result';
import { validateReportNote } from '../report-note';

describe('@vp/validation: validateReportNote', () => {
  it.each([
    { name: 'no note', note: undefined, normalized: null },
    { name: 'a blank note', note: ' \n\t ', normalized: null },
    { name: 'a trimmed note', note: '  rude  ', normalized: 'rude' },
    { name: 'a note at the ceiling', note: 'a'.repeat(500), normalized: 'a'.repeat(500) },
  ])('accepts $name', ({ note, normalized }) => {
    const result = validateReportNote(note);

    expect(isOk(result) && result.value).toBe(normalized);
  });

  it('rejects a note over the ceiling, naming the field', () => {
    const result = validateReportNote('a'.repeat(501));

    expect(isErr(result) && result.error).toMatchObject({
      code: ErrorCodes.VALIDATION_FAILED,
      field: 'note',
      maxLength: 500,
    });
  });
});
