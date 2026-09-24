import { formatNumbers } from '../format-numbers.helper';

describe('apps/web: number formatting', () => {
  it.each([
    { value: 0, precision: 0, shown: '0' },
    { value: -3, precision: 0, shown: '-3' },
    { value: 999, precision: 0, shown: '999' },
    { value: 1000, precision: 0, shown: '1K' },
    { value: 1500, precision: 0, shown: '2K' },
    { value: 1500, precision: 1, shown: '1.5K' },
    { value: 1000, precision: 1, shown: '1K' },
    { value: 2_500_000, precision: 1, shown: '2.5M' },
    { value: 7_000_000_000, precision: 0, shown: '7B' },
  ])('shows $value at precision $precision as $shown', ({ value, precision, shown }) => {
    expect(formatNumbers(value, precision)).toBe(shown);
  });

  it('rounds to whole units when no precision is given', () => {
    expect(formatNumbers(1234)).toBe('1K');
  });
});
