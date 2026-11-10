import { classifierTimestamps } from '../classifier-timestamps';

const SAMPLING = { classifyIntervalSeconds: 10, classifyMaxFrames: 120 };

describe('@vp/fingerprint: classifierTimestamps', () => {
  it.each([
    { scenario: 'a clip shorter than the interval', duration: 4, moments: [0, 2, 3.5] },
    { scenario: 'a clip of one interval', duration: 10, moments: [0, 5, 9.5] },
    { scenario: 'a 35 s clip', duration: 35, moments: [0, 10, 17.5, 20, 30, 34.5] },
    { scenario: 'a clip with no length', duration: 0, moments: [0] },
  ])('takes $moments from $scenario', ({ duration, moments }) => {
    expect(classifierTimestamps(duration, SAMPLING)).toEqual(moments);
  });

  it('spreads at most the cap, plus the middle and the last, over a long video', () => {
    const moments = classifierTimestamps(7200, SAMPLING);

    expect(moments).toHaveLength(121);
    expect(moments[0]).toBe(0);
    expect(moments.at(-1)).toBe(7199.5);
    expect(moments).toContain(3600);
    expect(
      moments.every((moment, index) => index === 0 || moment > (moments[index - 1] ?? 0))
    ).toBe(true);
  });

  it('keeps one frame a second at most', () => {
    const moments = classifierTimestamps(10.4, {
      classifyIntervalSeconds: 5,
      classifyMaxFrames: 120,
    });

    expect(moments).toEqual([0, 5, 9.9]);
  });
});
