import { FORMAT_KINDS, type FormatValue, KINDS_MATCH_UNION, formatValue } from '../format-value';
import { NOW, contextFor } from './fixtures';

const ISO = '2026-09-19T18:30:00.000Z';

const ONE_OF_EACH: readonly { value: FormatValue; expected: RegExp }[] = [
  { value: 'as authored', expected: /^as authored$/ },
  { value: 1500, expected: /^1,500$/ },
  { value: { type: 'count', value: 1_200_000 }, expected: /^1\.2[Mm]$/ },
  { value: { type: 'number', value: 1500 }, expected: /^1,500$/ },
  { value: { type: 'percent', value: 7 }, expected: /^7%$/ },
  { value: { type: 'bytes', value: 4_500_000 }, expected: /^4\.5 MB$/ },
  { value: { type: 'bitrate', value: 4_500_000 }, expected: /^4\.5 Mb\/s$/ },
  { value: { type: 'ordinal', value: 3 }, expected: /^3rd$/ },
  { value: { type: 'numberRange', value: [1, 5] }, expected: /^1\s?–\s?5$/u },
  { value: { type: 'money', value: 1250, units: 'minor' }, expected: /^£12\.50$/ },
  { value: { type: 'date', value: ISO }, expected: /^19 Sept? 2026$/ },
  { value: { type: 'time', value: ISO }, expected: /^18:30$/ },
  { value: { type: 'dateTime', value: ISO }, expected: /^19 Sept? 2026(,| at) 18:30$/ },
  { value: { type: 'dateRange', value: [ISO, NOW] }, expected: /^19\s?–\s?22 Sept? 2026$/u },
  { value: { type: 'relative', value: ISO }, expected: /^3 days ago$/ },
  { value: { type: 'calendarDay', value: NOW }, expected: /^today 18:30$/ },
  { value: { type: 'duration', value: 765 }, expected: /^12:45$/ },
  { value: { type: 'list', value: ['a', 'b', 'c'] }, expected: /^a, b and c$/ },
  { value: { type: 'displayName', value: 'sv', of: 'language' }, expected: /^Swedish$/ },
];

describe('@vp/intl: formatValue', () => {
  it.each(ONE_OF_EACH)('routes $value to its own formatter', ({ value, expected }) => {
    const rendered = formatValue(value, contextFor('en-GB', { currency: 'GBP' }));

    expect(rendered.ok && rendered.value).toMatch(expected);
  });

  it('covers every kind in the list', () => {
    const routed = ONE_OF_EACH.flatMap(({ value }) =>
      typeof value === 'object' ? [value.type] : []
    );

    expect([...routed].sort()).toEqual([...FORMAT_KINDS].sort());
    expect(KINDS_MATCH_UNION).toBe(true);
  });

  it('declines an unsupported locale with a failure, not a throw', () => {
    expect(formatValue({ type: 'count', value: 1 }, contextFor('xx'))).toMatchObject({
      ok: false,
      error: { code: 'FORMAT_UNSUPPORTED_LOCALE', locale: 'xx' },
    });
  });
});
