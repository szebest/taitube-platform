import { formatText, contextFor, format } from '../../__tests__/fixtures';
import { type DateOptions } from '../date';

const ISO = '2026-09-22T18:30:00.000Z';

function render(locale: string, options?: DateOptions, timeZone = 'UTC') {
  const rendered = format({ type: 'date', value: ISO, options }, contextFor(locale, { timeZone }));
  return rendered.ok ? rendered.value : rendered.error.code;
}

describe('@kit/intl: date', () => {
  it.each([
    { locale: 'en-US', expected: /^9\/22\/26$/ },
    { locale: 'en-GB', expected: /^22\/09\/2026$/ },
    { locale: 'de', expected: /^22\.09\.26$/ },
    { locale: 'ja', expected: /^2026\/09\/22$/ },
  ])('writes the short brand style the way $locale orders a date', ({ locale, expected }) => {
    expect(render(locale, { style: 'short' })).toMatch(expected);
  });

  it('renders in the context zone, not the runtime one', () => {
    expect(render('en-GB', { style: 'short' }, 'Pacific/Kiritimati')).toMatch(/^23\/09\/2026$/);
  });

  it('takes explicit fields instead of a style', () => {
    expect(render('en-GB', { day: 'numeric', month: 'long' })).toMatch(/^22 September$/);
  });

  it('declines a misspelt option rather than rendering a default', () => {
    // @ts-expect-error `stlye` is not an option date takes
    expect(render('en', { stlye: 'short' })).toBe('FORMAT_UNKNOWN_OPTION');
  });

  it('declines a value that is not ISO 8601', () => {
    const rendered = format({ type: 'date', value: 'Sep 22 2026' }, contextFor('en'));

    expect(rendered).toMatchObject({ ok: false, error: { code: 'FORMAT_UNRENDERABLE' } });
  });

  it.each([
    { options: { style: 'short', timeZone: 'Asia/Tokyo' }, expected: '9/23/26' },
    { options: { timeZone: 'Asia/Tokyo' }, expected: 'Sep 23, 2026' },
    { options: { year: 'numeric', calendar: 'japanese' }, expected: 'Reiwa' },
  ] as const)('takes $options', ({ options, expected }) => {
    expect(formatText({ type: 'date', value: ISO, options }, 'en-US')).toMatch(expected);
  });
});
