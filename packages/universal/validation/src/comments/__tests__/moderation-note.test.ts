import { ErrorCodes } from '@vp/errors';
import { isErr, isOk } from '@vp/result';
import { validateModerationNote } from '../moderation-note';

describe('@vp/validation: validateModerationNote', () => {
  it.each([
    { name: 'no note', note: undefined, normalized: null },
    { name: 'a blank note', note: ' \n\t ', normalized: null },
    { name: 'a trimmed note', note: '  off topic  ', normalized: 'off topic' },
    { name: 'a note at the ceiling', note: 'a'.repeat(200), normalized: 'a'.repeat(200) },
  ])('accepts $name', ({ note, normalized }) => {
    const result = validateModerationNote(note);

    expect(isOk(result) && result.value).toBe(normalized);
  });

  it('rejects a note over the ceiling, naming the field', () => {
    const result = validateModerationNote('a'.repeat(201));

    expect(isErr(result) && result.error).toMatchObject({
      code: ErrorCodes.VALIDATION_FAILED,
      field: 'note',
      maxLength: 200,
    });
  });
});
