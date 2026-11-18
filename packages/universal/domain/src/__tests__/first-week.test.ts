import { benchmarkDays, benchmarkEnvelope, cumulativeFirstWeek } from '../first-week';

const READY = new Date('2026-03-10T09:00:00.000Z');

describe('domain: cumulativeFirstWeek', () => {
  it.each([
    [
      'a video older than a week',
      [
        { dayOffset: 0, views: 5 },
        { dayOffset: 1, views: 3 },
        { dayOffset: 6, views: 2 },
      ],
      '2026-03-30T00:00:00.000Z',
      [5, 8, 8, 8, 8, 8, 10],
    ],
    [
      'a video on its third day, today included',
      [
        { dayOffset: 0, views: 5 },
        { dayOffset: 1, views: 3 },
      ],
      '2026-03-12T23:59:00.000Z',
      [5, 8, 8],
    ],
    [
      'a gap day carrying the total forward',
      [
        { dayOffset: 0, views: 4 },
        { dayOffset: 2, views: 1 },
      ],
      '2026-03-13T01:00:00.000Z',
      [4, 4, 5, 5],
    ],
    ['the day it became ready', [{ dayOffset: 0, views: 2 }], '2026-03-10T09:30:00.000Z', [2]],
    ['a clock behind the ready time', [], '2026-03-09T12:00:00.000Z', []],
    [
      'views past the first week',
      [
        { dayOffset: 7, views: 9 },
        { dayOffset: 0, views: 1 },
      ],
      '2026-04-30T00:00:00.000Z',
      [1, 1, 1, 1, 1, 1, 1],
    ],
  ])('reads %s', (_name, rows, today, expected) => {
    expect(cumulativeFirstWeek(rows, READY, new Date(today))).toEqual(expected);
  });

  it('starts day 0 at the UTC day, so a video ready late in it has begun day 1 a minute later', () => {
    const late = new Date('2026-03-10T23:59:00.000Z');

    expect(
      cumulativeFirstWeek([{ dayOffset: 0, views: 1 }], late, new Date('2026-03-11T00:00:00.000Z'))
    ).toEqual([1, 1]);
  });
});

describe('domain: benchmarkEnvelope', () => {
  const series = (first: number, step = 0) =>
    Array.from({ length: 7 }, (_, day) => first + day * step);

  it.each([
    ['no peers', []],
    ['two peers', [series(1), series(2)]],
  ])('has no envelope with %s', (_name, peers) => {
    expect(benchmarkEnvelope(peers)).toBeNull();
  });

  it.each([
    ['an odd count', [10, 20, 30], { p25: 15, median: 20, p75: 25 }],
    [
      'an even count interpolating the middle',
      [10, 20, 30, 40],
      { p25: 17.5, median: 25, p75: 32.5 },
    ],
    ['ties', [10, 10, 10, 50], { p25: 10, median: 10, p75: 20 }],
    ['an unordered input', [30, 10, 20], { p25: 15, median: 20, p75: 25 }],
    ['one value repeated', [7, 7, 7], { p25: 7, median: 7, p75: 7 }],
  ])('takes the percentiles of %s', (_name, firstDay, expected) => {
    const envelope = benchmarkEnvelope(firstDay.map((total) => series(total)));

    expect(envelope).toHaveLength(7);
    expect(envelope?.[0]).toEqual(expected);
  });

  it('computes each day on its own', () => {
    const envelope = benchmarkEnvelope([series(0, 10), series(0, 20), series(0, 30)]);

    expect(envelope?.map(({ median }) => median)).toEqual([0, 20, 40, 60, 80, 100, 120]);
  });
});

describe('domain: benchmarkDays', () => {
  const band = { p25: 1, median: 2, p75: 3 };

  it('fills the days the video has not begun with null views, beside the envelope', () => {
    const days = benchmarkDays(
      [4, 6],
      Array.from({ length: 7 }, () => band)
    );

    expect(days).toHaveLength(7);
    expect(days[1]).toEqual({ day: 1, views: 6, ...band });
    expect(days[2]).toEqual({ day: 2, views: null, ...band });
  });

  it('leaves the envelope null on every day without one', () => {
    expect(benchmarkDays([4], null)[0]).toEqual({
      day: 0,
      views: 4,
      p25: null,
      median: null,
      p75: null,
    });
  });
});
