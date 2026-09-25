import { ARABIC_INDIC_DIGIT, contextFor } from '../../__tests__/fixtures';
import { type DateTimeValue, dateTime } from '../date-time';

const ISO = '2026-09-22T18:30:00.000Z';

function render(locale: string, options?: DateTimeValue['options']) {
  const rendered = dateTime({ type: 'dateTime', value: ISO, options }, contextFor(locale));
  return rendered.ok ? rendered.value : rendered.error.code;
}

describe('@vp/intl: dateTime', () => {
  it.each([
    { locale: 'en-GB', expected: /^22 Sept? 2026(,| at) 18:30$/ },
    { locale: 'de', expected: /^22\.09\.2026, 18:30$/ },
    { locale: 'ja', expected: /^2026\/09\/22 18:30$/ },
  ])('puts the date before the time in $locale', ({ locale, expected }) => {
    expect(render(locale)).toMatch(expected);
  });

  it('writes Arabic-Indic digits in ar-EG', () => {
    expect(render('ar-EG')).toMatch(ARABIC_INDIC_DIGIT);
  });

  it.each([
    { options: { style: 'short' } as const, expected: /^22\/09\/2026, 18:30$/ },
    { options: { weekday: 'long', hour: '2-digit' } as const, expected: /^Tuesday(,| at) 18$/ },
  ])('follows $options', ({ options, expected }) => {
    expect(render('en-GB', options)).toMatch(expected);
  });
});
