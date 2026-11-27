import { kickWatchPartyMember } from '../watch-party-members';

describe('packages/api-contracts: watch party moderation', () => {
  it.each([
    { memberKey: 'user:0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b', ok: true },
    { memberKey: 'nobody', ok: false },
  ])('names the member $memberKey: $ok', ({ memberKey, ok }) => {
    expect(
      kickWatchPartyMember.params.safeParse({
        id: '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b',
        memberKey,
      }).success
    ).toBe(ok);
  });
});
