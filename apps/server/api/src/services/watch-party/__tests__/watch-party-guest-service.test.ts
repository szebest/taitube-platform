import { MS_PER_HOUR } from '@vp/domain/time';
import { ErrorCodes } from '@vp/errors';
import { expectErr, expectOk } from '@vp/testing/result';
import { banKey, fillPresence, GUEST_KEY, seedLink } from './watch-party-access-fixture';
import { guestJoined, setUpGuests } from './watch-party-guest-fixture';
import { GUEST_IP, reading } from './watch-party-test-deps';

describe('apps/server/api/services: WatchPartyGuestService.join', () => {
  it('issues a credential and a seat in one step, without handing the credential to the body', async () => {
    const guests = await setUpGuests();

    const { joined, session } = await guestJoined(guests);

    expect(joined.membership).toMatchObject({
      kind: 'guest',
      name: 'Guest 5500',
      joinedVia: 'link',
      roleIds: [],
      permissions: ['voice.join'],
    });
    expect(Object.keys(joined.membership)).not.toContain('credential');
    expect(
      await reading(guests.metrics.watchPartyJoinsTotal, { kind: 'guest', outcome: 'joined' })
    ).toBe(1);
    expect(guests.systemLines().map((line) => line?.event)).toEqual(['joined']);
    expect(joined.maxAgeSeconds).toBe(guests.deps.config.guestCredentialTtlSeconds);
    expect(joined.expiresAt).toBe(new Date(guests.clock.nowMs + 12 * MS_PER_HOUR).toISOString());
    expect(session).toMatchObject({
      principal: { kind: 'guest', name: 'Guest 5500' },
      ipHash: `ip:${guests.room.id}:${GUEST_IP}`,
    });
    expect(`guest:${session.principal.kind === 'guest' ? session.principal.guestId : ''}`).toBe(
      joined.membership.memberKey
    );
  });

  it('keeps the address hash on the seat for a ban, and writes the joined line', async () => {
    const guests = await setUpGuests();
    await guestJoined(guests);

    const seat = (await guests.seated()).find(({ kind }) => kind === 'guest');
    const lines = expectOk(
      await guests.repositories.watchPartyMessages.listAfter(guests.room.id, null, 10)
    );

    expect(seat).toMatchObject({ kind: 'guest', ipHash: `ip:${guests.room.id}:${GUEST_IP}` });
    expect(lines.map(({ system }) => system?.event)).toEqual(['joined']);
  });

  it('never gives two guests of a room the same number', async () => {
    const guests = await setUpGuests();

    const first = (await guestJoined(guests, '198.51.100.1')).joined.membership.name;
    const second = (await guestJoined(guests, '198.51.100.2')).joined.membership.name;

    expect([first, second]).toEqual(['Guest 5500', 'Guest 5501']);
  });

  it('lets a private room’s guest in with a link, once per use', async () => {
    const guests = await setUpGuests({ visibility: 'private', allowGuests: true });
    const token = await seedLink(guests, guests.room.id, { maxUses: 1 });

    const first = await guests.join(GUEST_IP, { invite: token });
    const second = await guests.join('198.51.100.2', { invite: token });

    expect(expectOk(first).membership.joinedVia).toBe('invite_link');
    expect(expectErr(second).code).toBe(ErrorCodes.WATCH_PARTY_INVITE_INVALID);
  });

  it.each([
    {
      scenario: 'guests off',
      body: { allowGuests: false },
      code: ErrorCodes.WATCH_PARTY_GUESTS_OFF,
    },
    {
      scenario: 'a private room without a link',
      body: { visibility: 'private' as const, allowGuests: true },
      code: ErrorCodes.WATCH_PARTY_NOT_FOUND,
    },
    {
      scenario: 'a password room, which a guest has no way to open',
      body: { password: 'open sesame' },
      code: ErrorCodes.WATCH_PARTY_PASSWORD_REQUIRED,
    },
  ])('refuses $scenario with $code', async ({ body, code }) => {
    const guests = await setUpGuests(body);

    expect(expectErr(await guests.join()).code).toBe(code);
  });

  it('refuses every guest when no salt can make their address hash', async () => {
    const guests = await setUpGuests({}, { secrets: { hashIp: () => null } });

    expect(expectErr(await guests.join()).code).toBe(ErrorCodes.WATCH_PARTY_GUESTS_OFF);
  });

  it('refuses a room that is closed or unknown', async () => {
    const guests = await setUpGuests();
    expectOk(
      await guests.repositories.watchPartyRooms.close(guests.room.id, 'owner', null, new Date())
    );

    expect(expectErr(await guests.join()).code).toBe(ErrorCodes.WATCH_PARTY_CLOSED);
    expect(
      expectErr(await guests.join(GUEST_IP, undefined, '018f0000-0000-7000-8000-0000000000ff')).code
    ).toBe(ErrorCodes.WATCH_PARTY_NOT_FOUND);
  });

  it('refuses a banned address with a fresh credential', async () => {
    const guests = await setUpGuests();
    await banKey(
      guests,
      guests.room.id,
      'guest:previouscredential00',
      `ip:${guests.room.id}:${GUEST_IP}`
    );

    expect(expectErr(await guests.join()).code).toBe(ErrorCodes.WATCH_PARTY_BANNED);
    expectOk(await guests.join('198.51.100.9'));
  });

  it('counts guests toward the capacity', async () => {
    const guests = await setUpGuests({ capacity: 10 });
    await fillPresence(guests, guests.room.id, 9);
    expectOk(
      await guests.presence.admit(guests.room.id, GUEST_KEY, {
        limit: null,
        nowMs: guests.clock.nowMs,
        staleBeforeMs: 0,
      })
    );

    expect(expectErr(await guests.join())).toMatchObject({
      code: ErrorCodes.WATCH_PARTY_FULL,
      present: 10,
      capacity: 10,
    });
  });

  it('allows five credentials an hour to one address and says when to come back', async () => {
    const guests = await setUpGuests();
    for (let credential = 0; credential < 5; credential += 1) expectOk(await guests.join());

    expect(expectErr(await guests.join())).toMatchObject({
      code: ErrorCodes.RATE_LIMITED,
      retryAfterSeconds: 3_600,
    });
    expectOk(await guests.join('198.51.100.9'));
  });

  it('allows thirty guest joins a minute to one room', async () => {
    const guests = await setUpGuests();
    for (let join = 0; join < 30; join += 1) expectOk(await guests.join(`198.51.100.${join}`));

    expect(expectErr(await guests.join('203.0.113.99'))).toMatchObject({
      code: ErrorCodes.RATE_LIMITED,
      retryAfterSeconds: 60,
    });
  });
});
