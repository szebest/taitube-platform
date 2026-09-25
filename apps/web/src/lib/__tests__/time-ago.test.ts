import { formatTimeAgo } from '../time-ago';

const NOW = new Date('2026-03-10T12:00:00.000Z');

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe('apps/web: time ago', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([
    { scenario: 'five minutes ago', offset: -5 * MINUTE, shown: '5 minutes ago' },
    { scenario: 'an hour ago', offset: -HOUR, shown: '1 hour ago' },
    { scenario: 'two days ago', offset: -2 * DAY, shown: '2 days ago' },
    { scenario: 'in the future', offset: 3 * HOUR, shown: 'in 3 hours' },
  ])('describes a moment $scenario', ({ offset, shown }) => {
    expect(formatTimeAgo(new Date(NOW.getTime() + offset))).toBe(shown);
  });

  it('accepts a timestamp as well as a date', () => {
    expect(formatTimeAgo(NOW.getTime() - HOUR)).toBe('1 hour ago');
  });
});
