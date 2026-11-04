import {
  HOURLY_WINDOW_HOURS,
  fillHourly,
  hourlyWindow,
  mergeHourlyCounts,
  viewHourOf,
} from '../hourly-views';

const NOW = new Date('2026-03-10T13:42:07.120Z');

describe('domain: hourly views', () => {
  it('buckets an instant into the start of its UTC hour', () => {
    expect(viewHourOf(NOW)).toBe('2026-03-10T13:00:00.000Z');
    expect(viewHourOf(new Date('2026-03-10T00:00:00.000Z'))).toBe('2026-03-10T00:00:00.000Z');
  });

  it('spans the last 48 hours, the current one included', () => {
    expect(hourlyWindow(NOW)).toEqual({
      from: '2026-03-08T14:00:00.000Z',
      to: '2026-03-10T13:00:00.000Z',
    });
  });

  it('fills the hours without a row with zero, oldest first', () => {
    const hourly = fillHourly(hourlyWindow(NOW), [
      { viewHour: '2026-03-10T12:00:00.000Z', views: 4 },
      { viewHour: '2026-03-08T14:00:00.000Z', views: 1 },
    ]);

    expect(hourly).toHaveLength(HOURLY_WINDOW_HOURS);
    expect(hourly[0]).toEqual({ viewHour: '2026-03-08T14:00:00.000Z', views: 1 });
    expect(hourly.at(-2)).toEqual({ viewHour: '2026-03-10T12:00:00.000Z', views: 4 });
    expect(hourly.at(-1)).toEqual({ viewHour: '2026-03-10T13:00:00.000Z', views: 0 });
  });

  it('merges repeated counts of one video and hour', () => {
    expect(
      mergeHourlyCounts([
        { videoId: 'a', viewHour: '2026-03-10T13:00:00.000Z', views: 1 },
        { videoId: 'b', viewHour: '2026-03-10T13:00:00.000Z', views: 2 },
        { videoId: 'a', viewHour: '2026-03-10T13:00:00.000Z', views: 3 },
      ])
    ).toEqual([
      { videoId: 'a', viewHour: '2026-03-10T13:00:00.000Z', views: 4 },
      { videoId: 'b', viewHour: '2026-03-10T13:00:00.000Z', views: 2 },
    ]);
  });
});
