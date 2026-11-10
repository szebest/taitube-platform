import { COUNTRIES, isCountryCode } from '../countries';

describe('@vp/domain: countries', () => {
  it('lists the 249 ISO 3166-1 codes once each, in capitals', () => {
    expect(COUNTRIES).toHaveLength(249);
    expect(new Set(COUNTRIES).size).toBe(249);
    expect(COUNTRIES.every((code) => /^[A-Z]{2}$/.test(code))).toBe(true);
  });

  it.each([
    ['PL', true],
    ['US', true],
    ['pl', false],
    ['XX', false],
    ['POL', false],
    ['', false],
  ])('answers %s with %s', (value, expected) => {
    expect(isCountryCode(value)).toBe(expected);
  });
});
