import { ACCENT_PATTERN, PREFERENCE_ID_PATTERN, TOKEN_GROUP_PATTERN } from '../preferences';

describe('domain: preference patterns', () => {
  it.each([
    {
      pattern: 'a preference id',
      regex: PREFERENCE_ID_PATTERN,
      value: 'nocturne-2',
      matches: true,
    },
    { pattern: 'a preference id', regex: PREFERENCE_ID_PATTERN, value: 'Sand', matches: false },
    { pattern: 'a preference id', regex: PREFERENCE_ID_PATTERN, value: '2-sand', matches: false },
    {
      pattern: 'a preference id',
      regex: PREFERENCE_ID_PATTERN,
      value: `a${'b'.repeat(31)}`,
      matches: true,
    },
    {
      pattern: 'a preference id',
      regex: PREFERENCE_ID_PATTERN,
      value: `a${'b'.repeat(32)}`,
      matches: false,
    },
    { pattern: 'a token group', regex: TOKEN_GROUP_PATTERN, value: 'fontSize', matches: true },
    { pattern: 'a token group', regex: TOKEN_GROUP_PATTERN, value: 'spacing', matches: true },
    { pattern: 'a token group', regex: TOKEN_GROUP_PATTERN, value: 'font-size', matches: false },
    { pattern: 'a token group', regex: TOKEN_GROUP_PATTERN, value: 'FontSize', matches: false },
    { pattern: 'an accent', regex: ACCENT_PATTERN, value: '#a1b2c3', matches: true },
    { pattern: 'an accent', regex: ACCENT_PATTERN, value: '#A1B2C3', matches: true },
    { pattern: 'an accent', regex: ACCENT_PATTERN, value: '#abc', matches: false },
    { pattern: 'an accent', regex: ACCENT_PATTERN, value: 'red', matches: false },
  ])('$pattern: $value matches $matches', ({ regex, value, matches }) => {
    expect(regex.test(value)).toBe(matches);
  });
});
