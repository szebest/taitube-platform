import { isOutside, rangeStartSeconds } from '../playback-range';

const RANGE = { startMs: 10_000, endMs: 20_000 };

describe('apps/client/web: the playback range', () => {
  it.each([
    { startMs: 0, seconds: 0 },
    { startMs: 10_000, seconds: 10 },
    { startMs: 1_500, seconds: 1.5 },
  ])('starts at $seconds s for $startMs ms', ({ startMs, seconds }) => {
    expect(rangeStartSeconds({ startMs, endMs: 60_000 })).toBe(seconds);
  });

  it.each([
    { at: 20, where: 'at its end', outside: true },
    { at: 25, where: 'past its end', outside: true },
    { at: 5, where: 'before its start', outside: true },
    { at: 9.5, where: 'at the seek tolerance before its start', outside: false },
    { at: 9.4, where: 'just past the seek tolerance before its start', outside: true },
    { at: 10, where: 'at its start', outside: false },
    { at: 15, where: 'inside it', outside: false },
  ])('is outside: $outside $where', ({ at, outside }) => {
    expect(isOutside(RANGE, at)).toBe(outside);
  });
});
