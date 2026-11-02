import { kpiChange } from '../kpi-change';

const SIGNED = { signDisplay: 'exceptZero' };

describe('apps/client/studio: kpiChange', () => {
  it.each([
    { given: 'a rise', current: 150, previous: 100, trend: 'up', value: 50 },
    { given: 'a fall', current: 75, previous: 100, trend: 'down', value: -25 },
    { given: 'no change', current: 100, previous: 100, trend: 'flat', value: 0 },
  ] as const)('gives $given as a signed percentage', ({ current, previous, trend, value }) => {
    expect(kpiChange(current, previous, 'percent')).toEqual({
      trend,
      value: { type: 'percent', value, options: SIGNED },
    });
  });

  it.each([
    { given: 'a gain over a loss', current: 4, previous: -3, trend: 'up', value: 7 },
    { given: 'a loss after a gain', current: -2, previous: 5, trend: 'down', value: -7 },
  ] as const)('gives $given as a signed count', ({ current, previous, trend, value }) => {
    expect(kpiChange(current, previous, 'count')).toEqual({
      trend,
      value: { type: 'number', value, options: SIGNED },
    });
  });

  it.each([
    { given: 'there is no previous period', previous: null, unit: 'count' },
    { given: 'the previous period was zero', previous: 0, unit: 'percent' },
  ] as const)('gives no change when $given', ({ previous, unit }) => {
    expect(kpiChange(10, previous, unit)).toBeNull();
  });
});
