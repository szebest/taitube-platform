import { ErrorCodes } from '@vp/errors';
import { SEEDED } from '@vp/testing';
import { seedVideo } from '../../__tests__/test-app';
import { buildWatchPartyApp, QUICK_PARTY, type WatchPartyApp } from './watch-party-app';

const ABSENT = '018f0000-0000-7000-8000-0000000000ff';
const PRIVATE_VIDEO = '018f0000-0000-7000-8000-00000000e0f1';
const OWNER_KEY = `user:${SEEDED.userId}`;

describe('watch party routes', () => {
  let world: WatchPartyApp;

  beforeEach(async () => {
    world = await buildWatchPartyApp({ watchParties: { maxOpenPerUser: 20 } });
    await seedVideo(world.repositories, {
      id: PRIVATE_VIDEO,
      ownerId: SEEDED.userId,
      title: 'Hidden',
      visibility: 'private',
    });
  });

  afterEach(async () => {
    await world.app.close();
  });

  it.each([
    { method: 'POST' as const, url: '/v1/watch-parties', payload: QUICK_PARTY },
    { method: 'PATCH' as const, url: `/v1/watch-parties/${ABSENT}`, payload: { version: 1 } },
    { method: 'POST' as const, url: `/v1/watch-parties/${ABSENT}/close` },
    { method: 'POST' as const, url: `/v1/watch-parties/${ABSENT}/join` },
    { method: 'POST' as const, url: `/v1/watch-parties/${ABSENT}/leave` },
    { method: 'GET' as const, url: '/v1/me/watch-parties' },
  ])('refuses a signed-out $method $url with 401', async ({ method, url, payload }) => {
    const res = await world.call('anonymous', method, url, { payload });

    expect(res.statusCode).toBe(401);
    expect(res.json().code).toBe(ErrorCodes.UNAUTHORIZED);
  });

  describe('POST /v1/watch-parties', () => {
    it('answers 201 with the room in its lobby, its owner named', async () => {
      const res = await world.call('owner', 'POST', '/v1/watch-parties', { payload: QUICK_PARTY });

      expect(res.statusCode).toBe(201);
      expect(res.json()).toMatchObject({
        status: 'open',
        phase: 'lobby',
        visibility: 'unlisted',
        allowGuests: true,
        owner: { memberKey: OWNER_KEY },
        version: 1,
      });
    });

    it.each([
      {
        scenario: 'a capacity over the ceiling',
        payload: { capacity: 201 },
        status: 422,
        code: ErrorCodes.VALIDATION_FAILED,
      },
      {
        scenario: 'an unknown preset',
        payload: { preset: 'party' },
        status: 400,
        code: ErrorCodes.VALIDATION_FAILED,
      },
      {
        scenario: 'a private video',
        payload: { source: { videoId: PRIVATE_VIDEO } },
        status: 422,
        code: ErrorCodes.WATCH_PARTY_VIDEO_NOT_SHAREABLE,
      },
    ])('refuses $scenario with $status', async ({ payload, status, code }) => {
      const res = await world.call('owner', 'POST', '/v1/watch-parties', {
        payload: { ...QUICK_PARTY, ...payload },
      });

      expect(res.statusCode).toBe(status);
      expect(res.json().code).toBe(code);
    });

    it('refuses the eleventh in an hour with 429 and how long to wait', async () => {
      for (let created = 0; created < 10; created += 1) await world.createRoom();

      const res = await world.call('owner', 'POST', '/v1/watch-parties', { payload: QUICK_PARTY });

      expect(res.statusCode).toBe(429);
      expect(res.json().code).toBe(ErrorCodes.RATE_LIMITED);
      expect(res.headers['retry-after']).toBe('3600');
    });

    it('refuses the fourth open room with 409', async () => {
      const limited = await buildWatchPartyApp();
      for (let created = 0; created < 3; created += 1) await limited.createRoom();

      const res = await limited.call('owner', 'POST', '/v1/watch-parties', {
        payload: QUICK_PARTY,
      });

      expect(res.statusCode).toBe(409);
      expect(res.json().code).toBe(ErrorCodes.WATCH_PARTY_LIMIT_REACHED);
      await limited.app.close();
    });
  });

  describe('GET /v1/watch-parties/:id', () => {
    it('previews a room to anyone without a seat', async () => {
      const { id } = await world.createRoom();

      const res = await world.call('anonymous', 'GET', `/v1/watch-parties/${id}`);

      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({
        id,
        features: { voice: false },
        viewer: { memberKey: null, canJoin: 'yes', actions: ['guest', 'sign_in'] },
      });
    });

    it('is 404 for a room that is not there and for a private one without a grant', async () => {
      const { id } = await world.createRoom('owner', { visibility: 'private' });

      const missing = await world.call('other', 'GET', `/v1/watch-parties/${ABSENT}`);
      const hidden = await world.call('other', 'GET', `/v1/watch-parties/${id}`);

      expect([missing.statusCode, hidden.statusCode]).toEqual([404, 404]);
      expect(hidden.json().code).toBe(ErrorCodes.WATCH_PARTY_NOT_FOUND);
    });

    it('opens a private room to the holder of an invite link through ?invite=', async () => {
      const { id } = await world.createRoom('owner', { visibility: 'private' });
      const token = await world.seedLink(id);

      const res = await world.call('other', 'GET', `/v1/watch-parties/${id}?invite=${token}`);

      expect(res.statusCode).toBe(200);
    });
  });

  describe('PATCH /v1/watch-parties/:id', () => {
    it('applies the settings and bumps the version', async () => {
      const { id, version } = await world.createRoom();

      const res = await world.call('owner', 'PATCH', `/v1/watch-parties/${id}`, {
        payload: { version, name: 'Renamed', capacity: 8 },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({ name: 'Renamed', capacity: 8, version: version + 1 });
    });

    it.each([
      {
        scenario: 'a stale version',
        who: 'owner' as const,
        version: 99,
        status: 409,
        code: ErrorCodes.VERSION_CONFLICT,
      },
      {
        scenario: 'someone who may not edit',
        who: 'other' as const,
        version: 1,
        status: 403,
        code: ErrorCodes.WATCH_PARTY_PERMISSION_MISSING,
      },
    ])('refuses $scenario with $status', async ({ who, version, status, code }) => {
      const { id } = await world.createRoom();

      const res = await world.call(who, 'PATCH', `/v1/watch-parties/${id}`, {
        payload: { version, name: 'No' },
      });

      expect(res.statusCode).toBe(status);
      expect(res.json().code).toBe(code);
    });

    it('refuses a closed room with 410', async () => {
      const { id, version } = await world.createRoom();
      await world.call('owner', 'POST', `/v1/watch-parties/${id}/close`);

      const res = await world.call('owner', 'PATCH', `/v1/watch-parties/${id}`, {
        payload: { version, name: 'Late' },
      });

      expect(res.statusCode).toBe(410);
    });
  });

  describe('POST /v1/watch-parties/:id/close', () => {
    it.each([
      { who: 'owner' as const, status: 200 },
      { who: 'admin' as const, status: 200 },
      { who: 'other' as const, status: 403 },
    ])('answers $status to $who', async ({ who, status }) => {
      const { id } = await world.createRoom();

      const res = await world.call(who, 'POST', `/v1/watch-parties/${id}/close`);

      expect(res.statusCode).toBe(status);
      if (status === 200) expect(res.json()).toMatchObject({ status: 'closed' });
    });

    it('answers 410 to a second close', async () => {
      const { id } = await world.createRoom();
      await world.call('owner', 'POST', `/v1/watch-parties/${id}/close`);

      expect((await world.call('owner', 'POST', `/v1/watch-parties/${id}/close`)).statusCode).toBe(
        410
      );
    });
  });
});
