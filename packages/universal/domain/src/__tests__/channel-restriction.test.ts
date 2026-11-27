import { isRestrictionActive, RESTRICTION_RETENTION_DAYS } from '../channel-restriction';

const NOW = new Date('2026-11-09T12:00:00Z');

describe('@vp/domain: channel restriction', () => {
  it.each([
    { expiresAt: null, active: true },
    { expiresAt: new Date('2026-11-09T12:00:01Z'), active: true },
    { expiresAt: new Date('2026-11-09T12:00:00Z'), active: false },
    { expiresAt: new Date('2026-11-08T12:00:00Z'), active: false },
  ])('is active: $active when it expires at $expiresAt', ({ expiresAt, active }) => {
    expect(isRestrictionActive({ expiresAt }, NOW)).toBe(active);
  });
});

describe('@vp/domain: restriction retention', () => {
  it('purges an ended restriction 30 days after it ended', () => {
    expect(RESTRICTION_RETENTION_DAYS).toBe(30);
  });
});
