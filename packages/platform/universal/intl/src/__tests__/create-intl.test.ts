import { map, ok } from '@kit/result';
import { createIntl } from '../create-intl';
import { formatKinds } from '../format-value';
import { createIntlCache } from '../intl-cache';
import { defineKind, optionKeys } from '../kind';
import { contextFor } from './fixtures';

const FIXED = {
  locale: 'de',
  timeZone: 'Europe/Berlin',
  currency: 'EUR',
  now: '2026-09-22T18:30:00.000Z',
} as const;

describe('@kit/intl: createIntl', () => {
  it('reads nothing from the runtime: a fixed context renders fixed text in node and jsdom alike', () => {
    const intl = createIntl({ ...FIXED, cache: createIntlCache() });
    const rendered = [
      intl.format({ type: 'relative', value: '2026-09-19T18:30:00.000Z' }),
      intl.format({ type: 'calendarDay', value: '2026-09-22T06:00:00.000Z' }),
      intl.format({ type: 'dateTime', value: '2026-09-22T06:00:00.000Z' }),
      intl.format({ type: 'money', value: 1250, options: { units: 'minor' } }),
      intl.format({ type: 'count', value: 1_234_567 }),
    ];

    const expected = [
      /^vor 3 Tagen$/,
      /^heute,? 08:00$/,
      /^22\.09\.2026, 08:00$/,
      /^12,50 €$/,
      /^1,2 Mio\.$/,
    ];

    for (const [index, result] of rendered.entries()) {
      expect(result.ok && result.value.replace(/\s/gu, ' ')).toMatch(expected[index] ?? /^$/);
    }
  });

  it('binds the kinds whose output is not text to its context', () => {
    const intl = createIntl(contextFor('sv'));
    const compare = intl.call('collator', undefined);

    expect(intl.call('pluralCategory', 1)).toEqual({ ok: true, value: 'one' });
    expect(compare.ok && ['Ö', 'Z', 'A'].sort(compare.value)).toEqual(['A', 'Z', 'Ö']);
    expect(intl.call('truncate', 'abcdef', { maxGraphemes: 3 })).toEqual(ok('ab…'));
    expect(intl.context.locale).toBe('sv');
  });

  it('formats a kind an app registers, which composes a built-in one through its context', () => {
    const shout = defineKind({
      name: 'shout',
      arg: (value): value is number => typeof value === 'number',
      options: optionKeys<{ readonly marks?: number }>(['marks']),
      render: (value, options, context) =>
        map(
          context.format({ type: 'number', value }),
          (digits) => `${digits}${'!'.repeat(options?.marks ?? 1)}`
        ),
    });
    const intl = createIntl(contextFor('en'), [...formatKinds, shout]);

    expect(intl.format({ type: 'shout', value: 1500, options: { marks: 2 } })).toEqual(
      ok('1,500!!')
    );
  });

  it.each([
    { scenario: 'a kind it does not register', value: { type: 'rating', value: 5 } },
    { scenario: 'a kind whose output is not text', value: { type: 'collator', value: undefined } },
  ])('declines $scenario', ({ value }) => {
    const intl = createIntl(contextFor('en'));

    // @ts-expect-error neither is a text kind of the built-in registry
    expect(intl.format(value)).toMatchObject({ ok: false, error: { code: 'FORMAT_WRONG_KIND' } });
  });

  it('constructs no Intl object across 1,000 repeat formats', () => {
    const intl = createIntl(contextFor('en'));
    intl.format({ type: 'count', value: 1 });
    const lookups = vi.spyOn(Intl.NumberFormat, 'supportedLocalesOf');

    for (let i = 0; i < 1_000; i++) intl.format({ type: 'count', value: i });

    expect(lookups).not.toHaveBeenCalled();
  });
});
