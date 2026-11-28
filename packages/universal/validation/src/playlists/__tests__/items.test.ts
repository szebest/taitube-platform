import { isErr, isOk } from '@kit/result';
import { ErrorCodes } from '@vp/errors';
import { validatePlaylistNote, validateSectionTitle } from '../items';

describe('@vp/validation: playlist item words', () => {
  it.each([
    { scenario: 'a note', note: '  Watch from 2:10 ', value: 'Watch from 2:10' },
    { scenario: 'a blank note', note: '   ', value: null },
    { scenario: 'no note', note: null, value: null },
    { scenario: '300 characters', note: 'n'.repeat(300), value: 'n'.repeat(300) },
  ])('keeps $scenario as $value', ({ note, value }) => {
    const result = validatePlaylistNote(note);

    expect(isOk(result) && result.value).toBe(value);
  });

  it('refuses a note over 300 characters', () => {
    const result = validatePlaylistNote('n'.repeat(301));

    expect(isErr(result) && result.error).toMatchObject({
      code: ErrorCodes.VALIDATION_FAILED,
      field: 'note',
    });
  });

  it.each([
    { title: '  Part one ', ok: true },
    { title: '   ', ok: false },
    { title: 's'.repeat(80), ok: true },
    { title: 's'.repeat(81), ok: false },
  ])('takes the section title "$title": $ok', ({ title, ok }) => {
    expect(isOk(validateSectionTitle(title))).toBe(ok);
  });
});
