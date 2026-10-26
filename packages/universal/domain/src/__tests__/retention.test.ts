import { fillRetentionCurve, retentionPercentOf } from '../retention';

describe('domain: retention', () => {
  it.each([
    ['the start', 0, 100, 0],
    ['a position inside the first step', 4, 100, 0],
    ['a position on a step', 50, 100, 50],
    ['a position between steps', 77, 100, 75],
    ['the end', 100, 100, 100],
    ['a position past the end', 130, 100, 100],
  ])('puts %s in its 5 percent step', (_name, currentTime, duration, percent) => {
    expect(retentionPercentOf(currentTime, duration)).toBe(percent);
  });

  it('fills every step from 0 to 100, counting zero where nobody reached', () => {
    const curve = fillRetentionCurve([
      { percent: 0, viewers: 100 },
      { percent: 50, viewers: 78 },
    ]);

    expect(curve).toHaveLength(21);
    expect(curve[0]).toEqual({ percent: 0, viewers: 100 });
    expect(curve[10]).toEqual({ percent: 50, viewers: 78 });
    expect(curve[20]).toEqual({ percent: 100, viewers: 0 });
  });
});
