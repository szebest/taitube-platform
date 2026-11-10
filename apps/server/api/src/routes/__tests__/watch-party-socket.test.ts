import { Adapters } from '@vp/adapters/composition';
import { ErrorCodes } from '@vp/errors';
import { SEEDED } from '@vp/testing';
import { expectOk } from '@vp/testing/result';
import {
  guestSession,
  GUEST_ID,
} from '../../services/watch-party/__tests__/watch-party-access-fixture';
import { buildWatchPartyApp, type WatchPartyApp } from './watch-party-app';

describe('the room socket’s one-time token route', () => {
  let world: WatchPartyApp;

  beforeEach(async () => {
    world = await buildWatchPartyApp();
  });

  afterEach(async () => {
    await world.app.close();
  });

  const ticketFor = (
    roomId: string,
    who: 'owner' | 'other' | 'anonymous',
    headers?: Record<string, string>
  ) => world.call(who, 'POST', `/v1/watch-parties/${roomId}/socket-ticket`, { headers });

  it.each([
    { who: 'the owner', as: 'owner' as const, role: 'user' },
    { who: 'a member who joined', as: 'other' as const, joins: true, role: 'user' },
  ])('hands $who a one-time socket token with 201', async ({ as, joins, role }) => {
    const { id } = await world.createRoom();
    if (joins) await world.call(as, 'POST', `/v1/watch-parties/${id}/join`);

    const res = await ticketFor(id, as);

    expect(res.statusCode).toBe(201);
    const { ticket, expiresAt } = res.json();
    expect(Date.parse(expiresAt)).toBeGreaterThan(Date.now());
    const grant = expectOk(await world.container.get(Adapters.WatchPartyGate).redeemTicket(ticket));
    expect(grant).toMatchObject({
      roomId: id,
      role: role.toUpperCase(),
      principal: { kind: 'user' },
    });
  });

  it('hands a guest on its credential a token with no platform role', async () => {
    const { id } = await world.createRoom();
    const headers = await world.credentialFor(guestSession());
    await world.call('anonymous', 'POST', `/v1/watch-parties/${id}/join`, { headers });

    const res = await ticketFor(id, 'anonymous', headers);

    expect(res.statusCode).toBe(201);
    const grant = expectOk(
      await world.container.get(Adapters.WatchPartyGate).redeemTicket(res.json().ticket)
    );
    expect(grant).toMatchObject({ role: null, principal: { kind: 'guest', guestId: GUEST_ID } });
  });

  it.each([
    {
      scenario: 'a signed-out caller',
      who: 'anonymous' as const,
      status: 401,
      code: ErrorCodes.UNAUTHORIZED,
    },
    {
      scenario: 'a stranger to the room',
      who: 'other' as const,
      status: 404,
      code: ErrorCodes.WATCH_PARTY_NOT_FOUND,
    },
  ])('refuses $scenario with $status', async ({ who, status, code }) => {
    const { id } = await world.createRoom();

    const res = await ticketFor(id, who);

    expect(res.statusCode).toBe(status);
    expect(res.json().code).toBe(code);
  });

  it('refuses a banned member with 403 and a closed room with 410', async () => {
    const banned = await world.createRoom();
    await world.call('other', 'POST', `/v1/watch-parties/${banned.id}/join`);
    await world.ban(banned.id, `user:${SEEDED.otherUserId}`);
    const closed = await world.createRoom();
    await world.call('other', 'POST', `/v1/watch-parties/${closed.id}/join`);
    await world.call('owner', 'POST', `/v1/watch-parties/${closed.id}/close`);

    const refused = await ticketFor(banned.id, 'other');
    const over = await ticketFor(closed.id, 'other');

    expect([refused.statusCode, refused.json().code]).toEqual([403, ErrorCodes.WATCH_PARTY_BANNED]);
    expect([over.statusCode, over.json().code]).toEqual([410, ErrorCodes.WATCH_PARTY_CLOSED]);
  });
});
