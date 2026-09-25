import { ARABIC_INDIC_DIGIT, ASCII_DIGIT, contextFor } from '../../__tests__/fixtures';
import { number, numberFormatOptions } from '../number';

function render(locale: string, value: number, options = {}) {
  return number({ type: 'number', value, options }, contextFor(locale));
}

describe('@vp/intl: number', () => {
  it.each([
    { locale: 'en', grouped: /^1,500$/ },
    { locale: 'de', grouped: /^1\.500$/ },
    { locale: 'fr', grouped: /^1\s500$/u },
  ])('groups thousands the way $locale does', ({ locale, grouped }) => {
    const rendered = render(locale, 1500);

    expect(rendered.ok && rendered.value).toMatch(grouped);
  });

  it('writes a non-Latin script in its own digits', () => {
    const rendered = render('ar-EG', 1500);

    expect(rendered.ok && rendered.value).toMatch(ARABIC_INDIC_DIGIT);
    expect(rendered.ok && rendered.value).not.toMatch(ASCII_DIGIT);
  });

  it.each([
    { locale: 'en', expected: /^3 days$/ },
    { locale: 'de', expected: /^3 Tage$/ },
    { locale: 'ja', expected: /^3\s?日$/ },
  ])('renders a unit when one is named, in $locale', ({ locale, expected }) => {
    const rendered = render(locale, 3, { unit: 'day', unitDisplay: 'long' });

    expect(rendered.ok && rendered.value).toMatch(expected);
  });

  it.each([
    { options: undefined, expected: { style: 'decimal' } },
    { options: { unit: 'day' }, expected: { unit: 'day', style: 'unit' } },
  ])('picks the Intl style from $options', ({ options, expected }) => {
    expect(numberFormatOptions(options)).toEqual(expected);
  });

  it('declines a value that is not finite', () => {
    expect(render('en', Number.NaN)).toMatchObject({ ok: false, error: { formatter: 'number' } });
  });

  it('declines an option it does not allow', () => {
    const declined = number(
      // @ts-expect-error currency formatting is money's job, not number's
      { type: 'number', value: 1, options: { currency: 'SEK' } },
      contextFor('en')
    );

    expect(declined).toMatchObject({
      ok: false,
      error: { code: 'FORMAT_UNKNOWN_OPTION', option: 'currency' },
    });
  });
});
