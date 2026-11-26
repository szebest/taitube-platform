import {
  MAX_ACTIVE_SHARE_LINKS,
  SHARE_LINK_LABEL_MAX_LENGTH,
  SHARE_LINK_TOKEN_LENGTH,
  mergeShareLinkCounts,
  shareLinkExpiresAt,
  shareLinkState,
} from '../share-links';

const NOW = new Date('2026-11-19T12:00:00.000Z');

describe('@vp/domain: share links', () => {
  it('holds 22-character tokens, 60-character labels and 50 active links per target', () => {
    expect([SHARE_LINK_TOKEN_LENGTH, SHARE_LINK_LABEL_MAX_LENGTH, MAX_ACTIVE_SHARE_LINKS]).toEqual([
      22, 60, 50,
    ]);
  });

  it.each([
    { expiry: '1h', expected: '2026-11-19T13:00:00.000Z' },
    { expiry: '24h', expected: '2026-11-20T12:00:00.000Z' },
    { expiry: '7d', expected: '2026-11-26T12:00:00.000Z' },
    { expiry: '30d', expected: '2026-12-19T12:00:00.000Z' },
  ] as const)('ends a $expiry link at $expected', ({ expiry, expected }) => {
    expect(shareLinkExpiresAt(expiry, NOW)?.toISOString()).toBe(expected);
  });

  it('never ends a link made to last', () => {
    expect(shareLinkExpiresAt('never', NOW)).toBeNull();
  });

  it.each([
    { name: 'without an end', expiresAt: null, revokedAt: null, expected: 'active' },
    {
      name: 'before its end',
      expiresAt: new Date('2026-11-19T12:00:00.001Z'),
      revokedAt: null,
      expected: 'active',
    },
    { name: 'at its end', expiresAt: NOW, revokedAt: null, expected: 'expired' },
    {
      name: 'revoked before its end',
      expiresAt: new Date('2026-11-20T00:00:00.000Z'),
      revokedAt: new Date('2026-11-19T11:00:00.000Z'),
      expected: 'revoked',
    },
    {
      name: 'revoked after it expired',
      expiresAt: new Date('2026-11-19T10:00:00.000Z'),
      revokedAt: new Date('2026-11-19T11:00:00.000Z'),
      expected: 'revoked',
    },
  ] as const)('calls a link $name $expected', ({ expiresAt, revokedAt, expected }) => {
    expect(shareLinkState({ expiresAt, revokedAt }, NOW)).toBe(expected);
  });

  it('adds the counts of one link and day together and keeps the rest apart', () => {
    expect(
      mergeShareLinkCounts([
        { linkId: 'l1', viewDate: '2026-11-19', opens: 1, views: 0, watchSeconds: 4 },
        { linkId: 'l1', viewDate: '2026-11-19', opens: 0, views: 1, watchSeconds: 6 },
        { linkId: 'l1', viewDate: '2026-11-20', opens: 1, views: 0, watchSeconds: 0 },
        { linkId: 'l2', viewDate: '2026-11-19', opens: 2, views: 2, watchSeconds: 1 },
      ])
    ).toEqual([
      { linkId: 'l1', viewDate: '2026-11-19', opens: 1, views: 1, watchSeconds: 10 },
      { linkId: 'l1', viewDate: '2026-11-20', opens: 1, views: 0, watchSeconds: 0 },
      { linkId: 'l2', viewDate: '2026-11-19', opens: 2, views: 2, watchSeconds: 1 },
    ]);
  });
});
