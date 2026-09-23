import { isErr, isOk } from '@vp/result';
import { DISPLAY_NAME_MAX_LENGTH, validateDisplayName } from '../display-name';

describe('@vp/validation: validateDisplayName', () => {
  it('trims and accepts a name within bounds', () => {
    const result = validateDisplayName('  Mateusz  ');

    expect(isOk(result) && result.value).toBe('Mateusz');
  });

  it.each([
    { name: 'an empty name', displayName: '' },
    { name: 'whitespace only', displayName: '   ' },
    { name: 'a name over the ceiling', displayName: 'a'.repeat(DISPLAY_NAME_MAX_LENGTH + 1) },
  ])('rejects $name', ({ displayName }) => {
    expect(isErr(validateDisplayName(displayName))).toBe(true);
  });
});
