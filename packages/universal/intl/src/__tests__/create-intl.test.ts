import { createIntl } from '../create-intl';
import { createIntlCache } from '../intl-cache';
import { contextFor } from './fixtures';

const FIXED = {
  locale: 'de',
  timeZone: 'Europe/Berlin',
  currency: 'EUR',
  now: '2026-09-22T18:30:00.000Z',
} as const;

describe('@vp/intl: createIntl', () => {
  it('reads nothing from the runtime: a fixed context renders fixed text in node and jsdom alike', () => {
    const intl = createIntl({ ...FIXED, cache: createIntlCache() });
    const rendered = [
      intl.format({ type: 'relative', value: '2026-09-19T18:30:00.000Z' }),
      intl.format({ type: 'calendarDay', value: '2026-09-22T06:00:00.000Z' }),
      intl.format({ type: 'dateTime', value: '2026-09-22T06:00:00.000Z' }),
      intl.format({ type: 'money', value: 1250, units: 'minor' }),
      intl.format({ type: 'count', value: 1_234_567 }),
    ];

    const expected = [
      /^vor 3 Tagen$/,
      /^heute,? 08:00$/,
      /^22\.09\.2026, 08:00$/,
      /^12,50 €$/,
      /^1,2 Mio\.$/,
    ];

    rendered.forEach((result, index) => {
      expect(result.ok && result.value.replace(/\s/gu, ' ')).toMatch(expected[index] ?? /^$/);
    });
  });

  it('binds the plural rules, the collator and truncation to its context', () => {
    const intl = createIntl(contextFor('sv'));
    const compare = intl.collator();

    expect(intl.pluralCategory(1)).toEqual({ ok: true, value: 'one' });
    expect(compare.ok && ['Ö', 'Z', 'A'].sort(compare.value)).toEqual(['A', 'Z', 'Ö']);
    expect(intl.truncate('abcdef', 3)).toEqual({ ok: true, value: 'ab…' });
    expect(intl.context.locale).toBe('sv');
  });

  it('constructs no Intl object across 1,000 repeat formats', () => {
    const intl = createIntl(contextFor('en'));
    intl.format({ type: 'count', value: 1 });
    const lookups = vi.spyOn(Intl.NumberFormat, 'supportedLocalesOf');

    for (let i = 0; i < 1_000; i++) intl.format({ type: 'count', value: i });

    expect(lookups).not.toHaveBeenCalled();
  });
});
