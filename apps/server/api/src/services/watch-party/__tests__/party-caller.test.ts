import { memberKeyOfCaller, principalOf } from '../party-caller';
import { guestSession } from './watch-party-access-fixture';
import { ANONYMOUS, discordSession, guestCaller, OWNER, userCaller } from './watch-party-test-deps';

describe('apps/server/api/services: the party caller', () => {
  it.each([
    { scenario: 'an account', caller: userCaller(OWNER), kind: 'user', key: `user:${OWNER.id}` },
    {
      scenario: 'a guest credential',
      caller: guestCaller(guestSession()),
      kind: 'guest',
      key: 'guest:guestaaaaaaaaaaaaaaaa',
    },
    {
      scenario: 'a Discord credential',
      caller: guestCaller(discordSession()),
      kind: 'discord',
      key: 'discord:123456789012345678',
    },
    {
      scenario: 'a guest who signed in, who acts as the account',
      caller: { ...userCaller(OWNER), party: guestSession() },
      kind: 'user',
      key: `user:${OWNER.id}`,
    },
  ])('is $kind for $scenario', ({ caller, kind, key }) => {
    expect(principalOf(caller)?.kind).toBe(kind);
    expect(memberKeyOfCaller(caller)).toBe(key);
  });

  it('is nobody without either credential', () => {
    expect(principalOf(ANONYMOUS)).toBeNull();
    expect(memberKeyOfCaller(ANONYMOUS)).toBeNull();
  });
});
