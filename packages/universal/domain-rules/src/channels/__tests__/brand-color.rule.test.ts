import { expectErr, expectOk } from '@vp/testing/result';
import { validateBrandColor } from '../brand-color.rule';

describe('validateBrandColor', () => {
  it.each([
    { name: 'a plain colour', hex: '#3366cc', stored: '#3366cc' },
    { name: 'upper case', hex: '#3366CC', stored: '#3366cc' },
    { name: 'pure yellow', hex: '#ffff00', stored: '#ffff00' },
    { name: 'near-white', hex: '#fefefe', stored: '#fefefe' },
    { name: 'near-black', hex: '#010101', stored: '#010101' },
    { name: 'none, which clears it', hex: null, stored: null },
  ])('accepts $name and stores $stored', ({ hex, stored }) => {
    expect(expectOk(validateBrandColor(hex))).toBe(stored);
  });

  it.each([
    { name: 'the empty string', hex: '' },
    { name: 'no hash', hex: '3366cc' },
    { name: 'three digits', hex: '#36c' },
    { name: 'eight digits', hex: '#3366cc29' },
    { name: 'a non-hex digit', hex: '#33g6cc' },
    { name: 'a trailing newline', hex: '#3366cc\n' },
    { name: 'a CSS injection', hex: '#3366cc;}body{display:none' },
    { name: 'a colour name', hex: 'red' },
  ])('refuses $name', ({ hex }) => {
    expect(expectErr(validateBrandColor(hex))).toMatchObject({
      code: 'VALIDATION_FAILED',
      field: 'brandColor',
    });
  });
});
