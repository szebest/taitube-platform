import { createWatchPartyInviteLink, inviteToWatchParty } from '../watch-party-invites';

describe('packages/api-contracts: watch party invites', () => {
  it.each([
    { count: 1, ok: true },
    { count: 20, ok: true },
    { count: 21, ok: false },
    { count: 0, ok: false },
  ])('invites $count people at once: $ok', ({ count, ok }) => {
    const userIds = Array.from({ length: count }, () => '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b');

    expect(inviteToWatchParty.body.safeParse({ userIds }).success).toBe(ok);
  });

  it('makes an invite link last 24 hours unless asked otherwise', () => {
    expect(createWatchPartyInviteLink.body.parse({})).toEqual({ ttl: '24h' });
  });
});
