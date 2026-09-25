import { ARABIC_INDIC_DIGIT, contextFor } from '../../__tests__/fixtures';
import { type TimeValue, time } from '../time';

const ISO = '2026-09-22T18:30:00.000Z';

function render(locale: string, options?: TimeValue['options'], timeZone = 'UTC') {
  const rendered = time({ type: 'time', value: ISO, options }, contextFor(locale, { timeZone }));
  return rendered.ok ? rendered.value : rendered.error.code;
}

describe('@vp/intl: time', () => {
  it.each([
    { locale: 'en-US', expected: /^6:30\sPM$/u },
    { locale: 'en-GB', expected: /^18:30$/ },
    { locale: 'de', expected: /^18:30$/ },
  ])('uses the clock $locale reads', ({ locale, expected }) => {
    expect(render(locale)).toMatch(expected);
  });

  it('writes Arabic-Indic digits in ar-EG', () => {
    expect(render('ar-EG')).toMatch(ARABIC_INDIC_DIGIT);
  });

  it('renders in the context zone', () => {
    expect(render('en-GB', { style: 'short' }, 'Europe/Stockholm')).toMatch(/^20:30$/);
  });
});
