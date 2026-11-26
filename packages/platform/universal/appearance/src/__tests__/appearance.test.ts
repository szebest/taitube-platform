import {
  ACCENT_PATTERN,
  CONTRAST_OPTIONS,
  DEFAULT_CONTRAST,
  DEFAULT_MODE,
  MODE_OPTIONS,
  PREFERENCE_ID_PATTERN,
  TOKEN_GROUP_PATTERN,
} from '../appearance';

describe('@kit/appearance', () => {
  it('defaults to an option it offers', () => {
    expect(MODE_OPTIONS).toContain(DEFAULT_MODE);
    expect(CONTRAST_OPTIONS).toContain(DEFAULT_CONTRAST);
  });

  it.each([
    { pattern: PREFERENCE_ID_PATTERN, value: 'sand', matches: true },
    { pattern: PREFERENCE_ID_PATTERN, value: 'high-contrast-2', matches: true },
    { pattern: PREFERENCE_ID_PATTERN, value: 'Sand', matches: false },
    { pattern: PREFERENCE_ID_PATTERN, value: '2sand', matches: false },
    { pattern: PREFERENCE_ID_PATTERN, value: `s${'a'.repeat(32)}`, matches: false },
    { pattern: TOKEN_GROUP_PATTERN, value: 'fontSize', matches: true },
    { pattern: TOKEN_GROUP_PATTERN, value: 'font-size', matches: false },
    { pattern: ACCENT_PATTERN, value: '#A1b2C3', matches: true },
    { pattern: ACCENT_PATTERN, value: '#abc', matches: false },
  ])('$pattern on $value is $matches', ({ pattern, value, matches }) => {
    expect(pattern.test(value)).toBe(matches);
  });
});
