import { ErrorCodes } from '@vp/errors';
import { expectErr, expectOk } from '@vp/testing/result';
import { validateRoleName, validateRoomName, validateRoomPassword } from '../room-details';

describe('@vp/validation: watch party room details', () => {
  it.each([
    { name: 'a plain name', input: 'Friday movie night', value: 'Friday movie night' },
    {
      name: 'line breaks and padding',
      input: '  Friday\nmovie\tnight ',
      value: 'Friday movie night',
    },
    { name: '60 emoji', input: '🎬'.repeat(60), value: '🎬'.repeat(60) },
  ])('accepts a room name of $name', ({ input, value }) => {
    expect(expectOk(validateRoomName(input))).toBe(value);
  });

  it.each([
    { name: 'nothing but spaces', input: '   ', field: { maxLength: 60 } },
    { name: '61 characters', input: 'a'.repeat(61), field: { maxLength: 60 } },
    { name: 'a link', input: 'join https://spam.example', field: { reason: 'url' } },
    { name: 'a www host', input: 'see www.spam.example', field: { reason: 'url' } },
  ])('refuses a room name of $name', ({ input, field }) => {
    expect(expectErr(validateRoomName(input))).toMatchObject({
      code: ErrorCodes.VALIDATION_FAILED,
      field: 'name',
      ...field,
    });
  });

  it.each([
    { scenario: '4 characters with a space kept', input: ' ab ', ok: true },
    { scenario: '64 characters', input: 'p'.repeat(64), ok: true },
    { scenario: '3 characters', input: 'abc', ok: false },
    { scenario: '65 characters', input: 'p'.repeat(65), ok: false },
  ])('takes a password of $scenario: $ok', ({ input, ok }) => {
    const result = validateRoomPassword(input);

    expect(result.ok).toBe(ok);
    if (result.ok) expect(result.value).toBe(input);
  });

  it.each([
    { scenario: 'a name', input: ' Organizer ', ok: true },
    { scenario: '33 characters', input: 'r'.repeat(33), ok: false },
    { scenario: 'an empty name', input: '', ok: false },
  ])('takes a role name of $scenario: $ok', ({ input, ok }) => {
    expect(validateRoleName(input).ok).toBe(ok);
  });
});
