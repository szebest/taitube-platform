import { PARTY_CREDENTIAL_HEADER } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { SEEDED } from '@vp/testing';
import { expectOk } from '@vp/testing/result';
import { guestSession } from '../../services/watch-party/__tests__/watch-party-access-fixture';
import { buildWatchPartyApp, type WatchPartyApp } from './watch-party-app';

const COOKIE = /^vp\.party-guest=([\w-]+); Path=\/; HttpOnly; SameSite=Lax; Max-Age=43200$/;
const OTHER_KEY = `user:${SEEDED.otherUserId}`;

describe('watch party guest routes', () => {
  let world: WatchPartyApp;

  beforeEach(async () => {
    world = await buildWatchPartyApp({ http: { trustProxy: ['127.0.0.1'] } });
  });

  afterEach(async () => {
    await world.app.close();
  });

  const joinAsGuest = (
    roomId: string,
    headers: Record<string, string> = {},
    payload?: Record<string, unknown>
  ) => world.call('anonymous', 'POST', `/v1/watch-parties/${roomId}/guest`, { headers, payload });

  const credentialOf = (setCookie: string | string[] | undefined) =>
    COOKIE.exec(String(setCookie))?.[1] ?? '';

  describe('POST /v1/watch-parties/:id/guest', () => {
    it('answers 201 with the seat, and the credential only in an httpOnly cookie', async () => {
      const { id } = await world.createRoom();

      const res = await joinAsGuest(id);

      expect(res.statusCode).toBe(201);
      expect(res.json()).toEqual({
        membership: expect.objectContaining({
          kind: 'guest',
          roomId: id,
          name: expect.stringMatching(/^Guest \d{4}$/),
        }),
        expiresAt: expect.any(String),
      });
      const credential = credentialOf(res.headers['set-cookie']);
      expect(credential).not.toBe('');
      expect(res.body).not.toContain(credential);
    });

    it('sets a credential that gets the guest into party routes and nothing else', async () => {
      const { id } = await world.createRoom();
      const joined = await joinAsGuest(id);
      const headers = { [PARTY_CREDENTIAL_HEADER]: credentialOf(joined.headers['set-cookie']) };

      const preview = await world.call('anonymous', 'GET', `/v1/watch-parties/${id}`, { headers });

      expect(preview.json().viewer).toMatchObject({
        memberKey: joined.json().membership.memberKey,
        canJoin: 'member',
        actions: ['sign_in'],
      });
    });

    it('marks the cookie Secure when the request came over https', async () => {
      const { id } = await world.createRoom();

      const res = await joinAsGuest(id, { 'x-forwarded-proto': 'https' });

      expect(String(res.headers['set-cookie'])).toMatch(/; Secure$/);
    });

    it.each([
      {
        scenario: 'a room without guests',
        body: { allowGuests: false },
        status: 403,
        code: ErrorCodes.WATCH_PARTY_GUESTS_OFF,
      },
      {
        scenario: 'a private room without a link',
        body: { visibility: 'private', allowGuests: true },
        status: 404,
        code: ErrorCodes.WATCH_PARTY_NOT_FOUND,
      },
    ])('refuses $scenario with $status', async ({ body, status, code }) => {
      const { id } = await world.createRoom('owner', body);

      const res = await joinAsGuest(id);

      expect(res.statusCode).toBe(status);
      expect(res.json().code).toBe(code);
      expect(res.headers['set-cookie']).toBeUndefined();
    });

    it('lets a private room’s guest in with a link', async () => {
      const { id } = await world.createRoom('owner', { visibility: 'private', allowGuests: true });
      const token = await world.seedLink(id);

      expect((await joinAsGuest(id, {}, { invite: token })).statusCode).toBe(201);
    });

    it('refuses a full room with 409, counting guests, and a closed one with 410', async () => {
      const { id } = await world.createRoom('owner', { capacity: 10 });
      await world.crowd(id, 10);
      const closed = await world.createRoom();
      await world.call('owner', 'POST', `/v1/watch-parties/${closed.id}/close`);

      expect((await joinAsGuest(id)).statusCode).toBe(409);
      expect((await joinAsGuest(closed.id)).statusCode).toBe(410);
    });

    it('refuses an address banned in the room, with a fresh credential', async () => {
      const { id } = await world.createRoom();
      const first = (await joinAsGuest(id)).json().membership.memberKey;
      const seat = expectOk(await world.repositories.watchPartyMembers.find(id, first));
      await world.ban(id, first, seat?.ipHash ?? null);

      const res = await joinAsGuest(id);

      expect(res.statusCode).toBe(403);
      expect(res.json().code).toBe(ErrorCodes.WATCH_PARTY_BANNED);
    });

    it('allows five credentials an hour to one address, then 429 with Retry-After', async () => {
      const { id } = await world.createRoom();
      for (let issued = 0; issued < 5; issued += 1)
        expect((await joinAsGuest(id)).statusCode).toBe(201);

      const res = await joinAsGuest(id);

      expect(res.statusCode).toBe(429);
      expect(res.json().code).toBe(ErrorCodes.RATE_LIMITED);
      expect(res.headers['retry-after']).toBe('3600');
    });
  });

  describe('POST /v1/watch-parties/:id/seat/upgrade', () => {
    async function guestInRoom() {
      const { id } = await world.createRoom();
      const joined = await joinAsGuest(id);
      const headers = { [PARTY_CREDENTIAL_HEADER]: credentialOf(joined.headers['set-cookie']) };
      const upgrade = (
        who: 'other' | 'anonymous' = 'other',
        sent: Record<string, string> = headers
      ) => world.call(who, 'POST', `/v1/watch-parties/${id}/seat/upgrade`, { headers: sent });
      return { id, headers, joined, upgrade };
    }

    it('moves the seat to the signed-in account and retires the guest credential', async () => {
      const { id, headers, upgrade } = await guestInRoom();

      const res = await upgrade();

      expect(res.statusCode).toBe(200);
      expect(res.json().membership).toMatchObject({ kind: 'user', memberKey: OTHER_KEY });
      expect(res.json().membership.permissions).toContain('chat.post');
      const stale = await world.call('anonymous', 'GET', `/v1/watch-parties/${id}`, { headers });
      expect(stale.statusCode).toBe(401);
      expect(stale.json().code).toBe(ErrorCodes.WATCH_PARTY_CREDENTIAL_INVALID);
    });

    it('refuses an account banned in the room with 403', async () => {
      const { id, upgrade } = await guestInRoom();
      await world.ban(id, OTHER_KEY);

      const res = await upgrade();

      expect(res.statusCode).toBe(403);
      expect(res.json().code).toBe(ErrorCodes.WATCH_PARTY_BANNED);
    });

    it.each([
      {
        scenario: 'a guest credential alone',
        who: 'anonymous' as const,
        status: 401,
        code: ErrorCodes.WATCH_PARTY_CREDENTIAL_INVALID,
      },
      {
        scenario: 'a session alone',
        who: 'other' as const,
        bare: true,
        status: 404,
        code: ErrorCodes.WATCH_PARTY_NOT_FOUND,
      },
      {
        scenario: 'neither',
        who: 'anonymous' as const,
        bare: true,
        status: 401,
        code: ErrorCodes.UNAUTHORIZED,
      },
    ])('refuses $scenario with $status', async ({ who, bare, status, code }) => {
      const { upgrade } = await guestInRoom();

      const res = await upgrade(who, bare ? {} : undefined);

      expect(res.statusCode).toBe(status);
      expect(res.json().code).toBe(code);
    });
  });

  describe('a party credential outside a party', () => {
    it.each([
      { method: 'GET' as const, url: '/v1/me/account' },
      { method: 'GET' as const, url: '/v1/me/notifications' },
      { method: 'GET' as const, url: '/v1/me/subscriptions' },
      { method: 'POST' as const, url: `/v1/channels/${SEEDED.channelId}/subscribers` },
    ])('is ignored by $method $url, which answers 401', async ({ method, url }) => {
      const headers = await world.credentialFor(guestSession());

      const res = await world.call('anonymous', method, url, { headers });

      expect(res.statusCode).toBe(401);
      expect(res.json().code).toBe(ErrorCodes.UNAUTHORIZED);
    });
  });
});
