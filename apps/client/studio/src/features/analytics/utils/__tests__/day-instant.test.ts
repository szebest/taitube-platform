import { dayInstant } from '../day-instant';

describe('apps/client/studio: dayInstant', () => {
  it('puts a UTC calendar day at noon, so no zone within twelve hours reads another day', () => {
    expect(dayInstant('2026-10-14')).toBe('2026-10-14T12:00:00Z');
    expect(new Date(dayInstant('2026-10-14')).getUTCDate()).toBe(14);
  });
});
