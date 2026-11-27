import { banExpiry } from '../ban-duration';

const NOW = new Date('2026-11-10T09:00:00.000Z');

describe('@vp/domain: banExpiry', () => {
  it.each([
    { duration: '1h', ends: '2026-11-10T10:00:00.000Z' },
    { duration: '24h', ends: '2026-11-11T09:00:00.000Z' },
    { duration: '7d', ends: '2026-11-17T09:00:00.000Z' },
    { duration: '30d', ends: '2026-12-10T09:00:00.000Z' },
    { duration: 'forever', ends: null },
  ] as const)('ends a $duration ban at $ends', ({ duration, ends }) => {
    expect(banExpiry(duration, NOW)).toBe(ends);
  });
});
