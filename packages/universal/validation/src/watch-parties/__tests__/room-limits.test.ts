import { ErrorCodes } from '@vp/errors';
import { expectErr } from '@vp/testing/result';
import { validateCapacity, validateSchedule } from '../room-limits';

const NOW = new Date('2026-11-06T20:00:00Z');
const minutes = (count: number) => new Date(NOW.getTime() + count * 60_000);

describe('@vp/validation: watch party limits', () => {
  it.each([
    { capacity: null, ok: true },
    { capacity: 2, ok: true },
    { capacity: 200, ok: true },
    { capacity: 1, ok: false },
    { capacity: 201, ok: false },
    { capacity: 2.5, ok: false },
  ])('takes a capacity of $capacity under a ceiling of 200: $ok', ({ capacity, ok }) => {
    expect(validateCapacity(capacity, 200).ok).toBe(ok);
  });

  it('names the ceiling when a capacity is above it', () => {
    expect(expectErr(validateCapacity(201, 200))).toMatchObject({
      code: ErrorCodes.VALIDATION_FAILED,
      field: 'capacity',
      max: 200,
    });
  });

  it.each([
    { scenario: 'no schedule', at: null, ok: true },
    { scenario: '5 minutes ahead', at: minutes(5), ok: true },
    { scenario: '30 days ahead', at: minutes(30 * 24 * 60), ok: true },
    { scenario: '4 minutes ahead', at: minutes(4), ok: false },
    { scenario: '31 days ahead', at: minutes(31 * 24 * 60), ok: false },
  ])('takes $scenario: $ok', ({ at, ok }) => {
    expect(validateSchedule(at, NOW).ok).toBe(ok);
  });
});
