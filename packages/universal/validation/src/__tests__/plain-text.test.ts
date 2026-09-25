import { normalizePlainText, withinLength } from '../plain-text';

describe('@vp/validation: plain text', () => {
  it.each([
    { name: 'surrounding whitespace', value: '  clip \n', normalized: 'clip' },
    { name: 'inner line breaks and tabs', value: 'a\nb\tc', normalized: 'a\nb\tc' },
    { name: 'control characters', value: 'be\u0000ll\u0007', normalized: 'bell' },
    { name: 'markup, kept as text', value: '<b>x</b>', normalized: '<b>x</b>' },
  ])('normalizes $name', ({ value, normalized }) => {
    expect(normalizePlainText(value)).toBe(normalized);
  });

  it.each([
    { name: 'an emoji at the ceiling', text: '🙂'.repeat(3), within: true },
    { name: 'one past the ceiling', text: 'abcd', within: false },
    { name: 'below the floor', text: '', within: false },
  ])('bounds $name in code points', ({ text, within }) => {
    expect(withinLength(text, { minLength: 1, maxLength: 3 })).toBe(within);
  });
});
