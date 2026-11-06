import {
  type PartyPrincipal,
  memberKeyOf,
  parseMemberKey,
  pickGuestDigits,
} from '../watch-party-principal';

const USER_ID = '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b';

describe('@vp/domain: party principals', () => {
  it.each<{ principal: PartyPrincipal; key: string }>([
    { principal: { kind: 'user', userId: USER_ID }, key: `user:${USER_ID}` },
    {
      principal: {
        kind: 'discord',
        discordUserId: '80351110224678912',
        name: 'Ana',
        avatarUrl: null,
      },
      key: 'discord:80351110224678912',
    },
    {
      principal: { kind: 'guest', guestId: 'g_4Hk9sPq2LmN8vR3t', name: 'Guest 4821' },
      key: 'guest:g_4Hk9sPq2LmN8vR3t',
    },
  ])('keys a $principal.kind as $key, and parses it back', ({ principal, key }) => {
    expect(memberKeyOf(principal)).toBe(key);
    expect(parseMemberKey(key)).toEqual({
      kind: principal.kind,
      id: key.slice(key.indexOf(':') + 1),
    });
  });

  it.each([
    { scenario: 'no kind', value: USER_ID },
    { scenario: 'an unknown kind', value: `admin:${USER_ID}` },
    { scenario: 'a user that is no uuid', value: 'user:42' },
    { scenario: 'a Discord id with letters', value: 'discord:8035111022467891a' },
    { scenario: 'a short guest id', value: 'guest:abc' },
  ])('refuses $scenario', ({ value }) => {
    expect(parseMemberKey(value)).toBeNull();
  });

  it.each([
    { scenario: 'a free number', taken: [], random: 0.5, digits: 5500 },
    { scenario: 'the next free past a taken one', taken: [5500, 5501], random: 0.5, digits: 5502 },
    { scenario: 'wrapping past 9999', taken: [9999], random: 0.99999, digits: 1000 },
  ])('picks $scenario', ({ taken, random, digits }) => {
    expect(pickGuestDigits(new Set(taken), () => random)).toBe(digits);
  });

  it('has no number left when every one is taken', () => {
    const every = new Set(Array.from({ length: 9000 }, (_, index) => 1000 + index));

    expect(pickGuestDigits(every, () => 0)).toBeNull();
  });
});
