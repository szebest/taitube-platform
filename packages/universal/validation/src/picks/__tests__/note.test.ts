import { ErrorCodes } from '@vp/errors';
import { expectErr, expectOk } from '@vp/testing/result';
import { PICK_NOTE_MAX_LENGTH, validatePickNote } from '../note';

describe('@vp/validation: validatePickNote', () => {
  it('caps the editorial line at 280 characters', () => {
    expect(PICK_NOTE_MAX_LENGTH).toBe(280);
  });

  it.each([
    { name: 'a plain note', input: 'Worth the ten minutes', note: 'Worth the ten minutes' },
    { name: 'a padded note', input: '  Worth it \n', note: 'Worth it' },
    { name: 'no note', input: null, note: null },
    { name: 'an omitted note', input: undefined, note: null },
    { name: 'a blank note', input: '   ', note: null },
    { name: 'the ceiling in emoji', input: '🎵'.repeat(280), note: '🎵'.repeat(280) },
  ])('accepts $name', ({ input, note }) => {
    expect(expectOk(validatePickNote(input))).toBe(note);
  });

  it('rejects a note over the ceiling and names the field', () => {
    expect(expectErr(validatePickNote('a'.repeat(281)))).toMatchObject({
      code: ErrorCodes.VALIDATION_FAILED,
      field: 'note',
      maxLength: 280,
    });
  });
});
