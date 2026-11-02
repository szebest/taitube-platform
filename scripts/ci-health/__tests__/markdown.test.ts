import { percent, share, table } from '../markdown';

describe('table', () => {
  it('renders a header, its rule and a row per entry', () => {
    expect(table(['Job', 'Runs'], [['unit', 3]])).toBe(
      '| Job | Runs |\n| --- | --- |\n| unit | 3 |'
    );
  });
});

describe('percent and share', () => {
  it.each([
    { part: 1, whole: 15, percentage: '6.7%', shared: '1 of 15, 6.7%' },
    { part: 0, whole: 0, percentage: 'n/a', shared: '0 of 0, n/a' },
  ])('reads $part of $whole as $percentage', ({ part, whole, percentage, shared }) => {
    expect(percent(part, whole)).toBe(percentage);
    expect(share(part, whole)).toBe(shared);
  });
});
