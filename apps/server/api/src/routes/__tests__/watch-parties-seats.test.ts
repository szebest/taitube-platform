import { ErrorCodes } from '@vp/errors';
import { SEEDED } from '@vp/testing';
import { guestSession } from '../../services/watch-party/__tests__/watch-party-access-fixture';
import {
  DISCORD_ID,
  discordSession,
} from '../../services/watch-party/__tests__/watch-party-test-deps';
import { buildWatchPartyApp, type WatchPartyApp } from './watch-party-app';

const PASSWORD = 'open sesame';
const OTHER_KEY = `user:${SEEDED.otherUserId}`;

describe('watch party seat routes', () => {
  let world: WatchPartyApp;

  beforeEach(async () => {
    world = await buildWatchPartyApp({ watchParties: { maxOpenPerUser: 20 } });
  });

  afterEach(async () => {
    await world.app.close();
  });

  describe('POST /v1/watch-parties/:id/join', () => {
    it('seats an account and answers its membership', async () => {
      const { id } = await world.createRoom();

      const res = await world.call('other', 'POST', `/v1/watch-parties/${id}/join`);

      expect(res.statusCode).toBe(200);
      expect(res.json().membership).toMatchObject({
        roomId: id,
        memberKey: OTHER_KEY,
        kind: 'user',
      });
    });

    it('seats a guest and a Discord member on their credential', async () => {
      const { id } = await world.createRoom();
      const guest = await world.credentialFor(guestSession());
      const discord = await world.credentialFor(discordSession());

      const asGuest = await world.call('anonymous', 'POST', `/v1/watch-parties/${id}/join`, {
        headers: guest,
      });
      const asDiscord = await world.call('anonymous', 'POST', `/v1/watch-parties/${id}/join`, {
        headers: discord,
      });

      expect([asGuest.json().membership.kind, asDiscord.json().membership.kind]).toEqual([
        'guest',
        'discord',
      ]);
    });

    it.each([
      {
        scenario: 'a private room',
        body: { visibility: 'private' },
        status: 404,
        code: ErrorCodes.WATCH_PARTY_NOT_FOUND,
      },
      {
        scenario: 'a room with a password and none sent',
        body: { password: PASSWORD },
        status: 403,
        code: ErrorCodes.WATCH_PARTY_PASSWORD_REQUIRED,
      },
      {
        scenario: 'a room with guests off, joined as a guest',
        body: { allowGuests: false },
        asGuest: true,
        status: 403,
        code: ErrorCodes.WATCH_PARTY_GUESTS_OFF,
      },
    ])('refuses $scenario with $status', async ({ body, asGuest, status, code }) => {
      const { id } = await world.createRoom('owner', body);
      const headers = asGuest ? await world.credentialFor(guestSession()) : undefined;

      const res = await world.call(
        asGuest ? 'anonymous' : 'other',
        'POST',
        `/v1/watch-parties/${id}/join`,
        { headers }
      );

      expect(res.statusCode).toBe(status);
      expect(res.json().code).toBe(code);
    });

    it('refuses a revoked link with 403 and seats nobody', async () => {
      const { id } = await world.createRoom('owner', { visibility: 'private' });
      const token = await world.seedLink(id, { revokedAt: new Date(0) });

      const res = await world.call('other', 'POST', `/v1/watch-parties/${id}/join`, {
        payload: { invite: token },
      });

      expect(res.statusCode).toBe(403);
      expect(res.json().code).toBe(ErrorCodes.WATCH_PARTY_INVITE_INVALID);
    });

    it('locks the sixth wrong password with 429 and Retry-After', async () => {
      const { id } = await world.createRoom('owner', { password: PASSWORD });
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const wrong = await world.call('other', 'POST', `/v1/watch-parties/${id}/join`, {
          payload: { password: 'not it at all' },
        });
        expect([wrong.statusCode, wrong.json().code]).toEqual([
          403,
          ErrorCodes.WATCH_PARTY_PASSWORD_INVALID,
        ]);
      }

      const locked = await world.call('other', 'POST', `/v1/watch-parties/${id}/join`, {
        payload: { password: PASSWORD },
      });

      expect(locked.statusCode).toBe(429);
      expect(locked.json().code).toBe(ErrorCodes.WATCH_PARTY_PASSWORD_LOCKED);
      expect(locked.headers['retry-after']).toBe('900');
    });

    it('refuses a full room with 409 and says how full', async () => {
      const { id } = await world.createRoom('owner', { capacity: 10 });
      await world.crowd(id, 10);

      const res = await world.call('other', 'POST', `/v1/watch-parties/${id}/join`);

      expect(res.statusCode).toBe(409);
      expect(res.json()).toMatchObject({
        code: ErrorCodes.WATCH_PARTY_FULL,
        errors: [{ present: 10, capacity: 10 }],
      });
    });

    it('refuses a Discord member banned by key, whichever way the credential was issued', async () => {
      const { id } = await world.createRoom();
      await world.ban(id, `discord:${DISCORD_ID}`);
      const discord = await world.credentialFor(discordSession());

      const res = await world.call('anonymous', 'POST', `/v1/watch-parties/${id}/join`, {
        headers: discord,
      });

      expect(res.statusCode).toBe(403);
      expect(res.json().code).toBe(ErrorCodes.WATCH_PARTY_BANNED);
    });

    it('refuses a closed room with 410', async () => {
      const { id } = await world.createRoom();
      await world.call('owner', 'POST', `/v1/watch-parties/${id}/close`);

      expect((await world.call('other', 'POST', `/v1/watch-parties/${id}/join`)).statusCode).toBe(
        410
      );
    });
  });

  describe('leave, roster and my rooms', () => {
    it('leaves with 204 and then holds no seat', async () => {
      const { id } = await world.createRoom();
      await world.call('other', 'POST', `/v1/watch-parties/${id}/join`);

      const left = await world.call('other', 'POST', `/v1/watch-parties/${id}/leave`);
      const again = await world.call('other', 'POST', `/v1/watch-parties/${id}/leave`);

      expect([left.statusCode, again.statusCode]).toEqual([204, 404]);
    });

    it('shows a member the roster and anyone else the preview', async () => {
      const { id } = await world.createRoom();
      await world.call('other', 'POST', `/v1/watch-parties/${id}/join`);

      const member = await world.call('other', 'GET', `/v1/watch-parties/${id}/roster`);
      const visitor = await world.call('anonymous', 'GET', `/v1/watch-parties/${id}/roster`);

      expect(member.json()).toMatchObject({ view: 'members', guests: 0 });
      expect(member.json().entries).toHaveLength(2);
      expect(visitor.json()).toMatchObject({ view: 'preview', preview: { total: 0 } });
    });

    it('is 404 on a private room’s roster for a stranger', async () => {
      const { id } = await world.createRoom('owner', { visibility: 'private' });

      expect((await world.call('other', 'GET', `/v1/watch-parties/${id}/roster`)).statusCode).toBe(
        404
      );
    });

    it('lists the rooms I own and the open ones I sit in', async () => {
      const mine = await world.createRoom('owner');
      const theirs = await world.createRoom('other');
      await world.call('owner', 'POST', `/v1/watch-parties/${theirs.id}/join`);

      const res = await world.call('owner', 'GET', '/v1/me/watch-parties');

      expect(res.statusCode).toBe(200);
      expect(res.json().owning.map(({ id }: { id: string }) => id)).toEqual([mine.id]);
      expect(res.json().joined.map(({ id }: { id: string }) => id)).toEqual([theirs.id]);
      expect(res.json().interested).toEqual([]);
    });
  });
});
