import type { TaggedValue } from '../format-value';
import { defaultsFor, scale } from '../number-kind';
import { contextFor, format } from './fixtures';

describe('@kit/intl: number kinds', () => {
  it.each<{ value: TaggedValue; expected: RegExp }>([
    {
      value: { type: 'percent', value: 7, options: { minimumFractionDigits: 2 } },
      expected: /^7\.00%$/,
    },
    {
      value: { type: 'percent', value: 7.25, options: { maximumFractionDigits: 2 } },
      expected: /^7\.25%$/,
    },
    {
      value: { type: 'bytes', value: 4_500_000, options: { maximumFractionDigits: 2 } },
      expected: /^4\.5 MB$/,
    },
    {
      value: { type: 'bitrate', value: 4_567_000, options: { maximumFractionDigits: 2 } },
      expected: /^4\.57 Mb\/s$/,
    },
    {
      value: { type: 'count', value: 1_234_567, options: { minimumFractionDigits: 2 } },
      expected: /^1\.23\d?M$/,
    },
  ])('lets a valid caller option win over a default: $value', ({ value, expected }) => {
    const rendered = format(value, contextFor('en'));

    expect(rendered.ok && rendered.value).toMatch(expected);
  });

  it.each([
    { options: {}, expected: { maximumFractionDigits: 1 } },
    { options: { minimumFractionDigits: 2 }, expected: {} },
    { options: { maximumSignificantDigits: 3 }, expected: { maximumFractionDigits: 1 } },
  ])('keeps the defaults $options leaves room for', ({ options, expected }) => {
    const kept = defaultsFor({ maximumFractionDigits: 1 }, options);

    expect(JSON.parse(JSON.stringify(kept))).toEqual(expected);
  });

  it.each([
    { value: 999, expected: { amount: 999, unit: 'a' } },
    { value: 1500, expected: { amount: 1.5, unit: 'b' } },
    { value: 5_000_000_000, expected: { amount: 5000, unit: 'c' } },
    { value: -2000, expected: { amount: -2, unit: 'b' } },
  ])(
    'scales $value to the largest unit it reaches, the last one capping it',
    ({ value, expected }) => {
      expect(scale(value, 1000, ['a', 'b', 'c'])).toEqual(expected);
    }
  );
});
