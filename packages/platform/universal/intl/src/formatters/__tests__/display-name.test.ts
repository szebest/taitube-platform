import { contextFor } from '../../__tests__/fixtures';
import { USER } from '../../context';
import { type DisplayNameValue, displayName } from '../display-name';

function render(locale: string, value: DisplayNameValue, currency?: string) {
  const rendered = displayName(value, contextFor(locale, { currency }));
  return rendered.ok ? rendered.value : rendered.error.code;
}

describe('@vp/intl: displayName', () => {
  it.each([
    {
      locale: 'en',
      value: { type: 'displayName', value: 'sv', of: 'language' } as const,
      expected: 'Swedish',
    },
    {
      locale: 'en',
      value: { type: 'displayName', value: 'SE', of: 'region' } as const,
      expected: 'Sweden',
    },
    {
      locale: 'en',
      value: { type: 'displayName', value: 'GBP', of: 'currency' } as const,
      expected: 'British Pound',
    },
    {
      locale: 'de',
      value: { type: 'displayName', value: 'sv', of: 'language' } as const,
      expected: 'Schwedisch',
    },
    {
      locale: 'ja',
      value: { type: 'displayName', value: 'SE', of: 'region' } as const,
      expected: 'スウェーデン',
    },
  ])('names $value.value in $locale', ({ locale, value, expected }) => {
    expect(render(locale, value)).toBe(expected);
  });

  it.each([
    { of: 'language' as const, expected: /^svenska$/i },
    { of: 'currency' as const, expected: /^svensk krona$/i },
  ])("names the viewer's own $of", ({ of, expected }) => {
    expect(render('sv', { type: 'displayName', value: USER, of }, 'SEK')).toMatch(expected);
  });

  it.each([
    {
      scenario: 'a code with no name',
      value: { type: 'displayName', value: 'QQ', of: 'region' } as const,
    },
    {
      scenario: 'a malformed code',
      value: { type: 'displayName', value: '!!', of: 'language' } as const,
    },
    {
      scenario: 'a viewer region nobody configured',
      value: { type: 'displayName', value: USER, of: 'region' } as const,
    },
  ])('declines $scenario', ({ value }) => {
    expect(render('en', value)).toBe('FORMAT_UNRENDERABLE');
  });
});
