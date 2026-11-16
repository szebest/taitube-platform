import { type RetentionPoint, fillRetentionCurve } from '@vp/domain';
import { dropOffMoments } from '../drop-off-moments';

const curveOf = (viewers: readonly number[]): RetentionPoint[] =>
  fillRetentionCurve(viewers.map((count, step) => ({ percent: step * 5, viewers: count })));

const STEEP = curveOf([
  100, 90, 88, 60, 58, 58, 40, 39, 39, 39, 39, 39, 39, 39, 39, 39, 39, 30, 29, 29, 29,
]);

describe('@vp/domain-rules: dropOffMoments', () => {
  it.each([
    { scenario: 'no curve', curve: [], duration: 600 },
    { scenario: 'a single point', curve: [{ percent: 0, viewers: 10 }], duration: 600 },
    { scenario: 'nobody who began', curve: curveOf(Array(21).fill(0)), duration: 600 },
    { scenario: 'a flat curve', curve: curveOf(Array(21).fill(50)), duration: 600 },
    {
      scenario: 'a curve that only bounces at the first step',
      curve: curveOf([100, 40, ...Array(19).fill(40)]),
      duration: 600,
    },
    { scenario: 'a video with no duration', curve: STEEP, duration: 0 },
  ])('lists no drop-offs for $scenario', ({ curve, duration }) => {
    expect(dropOffMoments(curve, duration)).toEqual([]);
  });

  it('lists the three largest drops after the first step, largest first, at the start of their bucket', () => {
    expect(dropOffMoments(STEEP, 600)).toEqual([
      { percent: 10, positionSeconds: 60, lostShare: 0.28 },
      { percent: 25, positionSeconds: 150, lostShare: 0.18 },
      { percent: 80, positionSeconds: 480, lostShare: 0.09 },
    ]);
  });

  it('breaks a tie in favour of the earlier moment', () => {
    const tied = curveOf([100, 100, 90, 90, 80, 80, 70, ...Array(14).fill(70)]);

    expect(dropOffMoments(tied, 100).map(({ percent }) => percent)).toEqual([5, 15, 25]);
  });

  it('lists fewer than three when the curve drops fewer times', () => {
    expect(dropOffMoments(curveOf([100, 100, 70, ...Array(18).fill(70)]), 100)).toEqual([
      { percent: 5, positionSeconds: 5, lostShare: 0.3 },
    ]);
  });

  it('floors a position to the whole second', () => {
    expect(dropOffMoments(curveOf([100, 100, 50, ...Array(18).fill(50)]), 61)[0]).toMatchObject({
      positionSeconds: 3,
    });
  });
});
