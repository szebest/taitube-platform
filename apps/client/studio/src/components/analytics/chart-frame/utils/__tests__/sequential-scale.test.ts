import { SEQUENTIAL, sequentialScale } from '../sequential-scale';

describe('apps/client/studio: sequentialScale', () => {
  it('offers the five sequential steps, lightest first', () => {
    expect(SEQUENTIAL).toEqual([1, 2, 3, 4, 5].map((step) => `var(--dataviz-sequential-${step})`));
  });

  it.each([
    { value: 0, step: 1 },
    { value: 19, step: 1 },
    { value: 20, step: 2 },
    { value: 59, step: 3 },
    { value: 80, step: 5 },
    { value: 100, step: 5 },
    { value: -40, step: 1 },
    { value: 140, step: 5 },
  ])('puts $value of 0 to 100 on step $step', ({ value, step }) => {
    expect(sequentialScale(value, 0, 100)).toBe(`var(--dataviz-sequential-${step})`);
  });

  it('puts every value of an empty range on the first step', () => {
    expect(sequentialScale(7, 7, 7)).toBe('var(--dataviz-sequential-1)');
  });
});
