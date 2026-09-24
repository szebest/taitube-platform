import {
  MICROSECONDS_PER_MS,
  MS_PER_DAY,
  MS_PER_HOUR,
  MS_PER_MINUTE,
  MS_PER_SECOND,
  SECONDS_PER_DAY,
  SECONDS_PER_HOUR,
  SECONDS_PER_MINUTE,
} from '@vp/domain/time';

describe('packages/domain: time units', () => {
  it.each([
    { unit: 'MS_PER_SECOND', value: MS_PER_SECOND, expected: 1_000 },
    { unit: 'MS_PER_MINUTE', value: MS_PER_MINUTE, expected: 60_000 },
    { unit: 'MS_PER_HOUR', value: MS_PER_HOUR, expected: 3_600_000 },
    { unit: 'MS_PER_DAY', value: MS_PER_DAY, expected: 86_400_000 },
    { unit: 'SECONDS_PER_MINUTE', value: SECONDS_PER_MINUTE, expected: 60 },
    { unit: 'SECONDS_PER_HOUR', value: SECONDS_PER_HOUR, expected: 3_600 },
    { unit: 'SECONDS_PER_DAY', value: SECONDS_PER_DAY, expected: 86_400 },
    { unit: 'MICROSECONDS_PER_MS', value: MICROSECONDS_PER_MS, expected: 1_000 },
  ])('holds $unit at $expected', ({ value, expected }) => {
    expect(value).toBe(expected);
  });
});
