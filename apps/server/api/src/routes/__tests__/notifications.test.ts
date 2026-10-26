import type { NewNotificationInput } from '@vp/domain';
import { mintToken } from '@vp/dev-token';
import { ErrorCodes } from '@vp/errors';
import { SEEDED } from '@vp/testing';
import { expectOk } from '@vp/testing/result';
import { bearer, buildTestApp, type TestApp } from '../../__tests__/test-app';

const SESSION = {
  owner: bearer(mintToken({ sub: SEEDED.userId, role: 'user', ttl: '1h' })),
  stranger: bearer(mintToken({ sub: SEEDED.otherUserId, role: 'user', ttl: '1h' })),
  anonymous: {},
};

const VIDEOS = [
  '018f0000-0000-7000-8000-0000000000a1',
  '018f0000-0000-7000-8000-0000000000a2',
  '018f0000-0000-7000-8000-0000000000a3',
] as const;

function notification(
  userId: string,
  overrides: Partial<NewNotificationInput> & { videoId: string }
): NewNotificationInput {
  return {
    userId,
    kind: 'upload',
    actorChannelId: null,
    commentId: null,
    groupKey: null,
    payload: { actor: null, videoTitle: 'Dinner', excerpt: null, outcome: null },
    ...overrides,
  };
}

describe('notification routes', () => {
  let ctx: TestApp;

  beforeAll(async () => {
    ctx = await buildTestApp();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  beforeEach(async () => {
    const { notifications, userEvents } = ctx.repositories;
    notifications.clear();
    userEvents.clear();
    await notifications.record(notification(SEEDED.userId, { videoId: VIDEOS[0], kind: 'upload' }));
    await notifications.record(notification(SEEDED.userId, { videoId: VIDEOS[1], kind: 'reply' }));
    await notifications.record(
      notification(SEEDED.userId, { videoId: VIDEOS[2], kind: 'comment' })
    );
    await notifications.record(
      notification(SEEDED.otherUserId, { videoId: VIDEOS[0], kind: 'upload' })
    );
  });

  const call = (
    method: 'GET' | 'POST',
    url: string,
    session: keyof typeof SESSION = 'owner',
    payload?: Record<string, unknown>
  ) => ctx.app.inject({ method, url, headers: SESSION[session], payload });

  const idsOf = async (session: keyof typeof SESSION = 'owner') =>
    expectOk(
      await ctx.repositories.notifications.list(
        session === 'owner' ? SEEDED.userId : SEEDED.otherUserId,
        { filter: 'all', limit: 10 }
      )
    ).map(({ id }) => id);

  it.each([
    { method: 'GET' as const, url: '/v1/me/notifications' },
    { method: 'GET' as const, url: '/v1/me/notifications/unread-count' },
    { method: 'POST' as const, url: '/v1/me/notifications/read' },
  ])('refuses an anonymous $method $url with 401', async ({ method, url }) => {
    const res = await call(method, url, 'anonymous', method === 'POST' ? { all: true } : undefined);

    expect(res.statusCode).toBe(401);
    expect(res.json().code).toBe(ErrorCodes.UNAUTHORIZED);
  });

  it.each([
    { filter: undefined, kinds: ['comment', 'reply', 'upload'] },
    { filter: 'all', kinds: ['comment', 'reply', 'upload'] },
    { filter: 'subscriptions', kinds: ['upload'] },
    { filter: 'mentions', kinds: ['reply'] },
  ])('lists the filter $filter newest first, the caller own only', async ({ filter, kinds }) => {
    const res = await call('GET', `/v1/me/notifications${filter ? `?filter=${filter}` : ''}`);

    expect(res.statusCode).toBe(200);
    expect(res.json().items.map((item: { kind: string }) => item.kind)).toEqual(kinds);
    expect(res.json().nextCursor).toBeNull();
  });

  it('walks the list by cursor', async () => {
    const first = (await call('GET', '/v1/me/notifications?limit=2')).json();
    const rest = (
      await call('GET', `/v1/me/notifications?limit=2&cursor=${first.nextCursor}`)
    ).json();

    expect(first.items).toHaveLength(2);
    expect(rest.items).toHaveLength(1);
    expect(rest.nextCursor).toBeNull();
    expect([...first.items, ...rest.items].map((item: { id: string }) => item.id)).toEqual(
      await idsOf()
    );
  });

  it('shows a notification as read once it is', async () => {
    const [newest] = await idsOf();
    await call('POST', '/v1/me/notifications/read', 'owner', { ids: [newest] });

    const items = (await call('GET', '/v1/me/notifications')).json().items;

    expect(items.map((item: { read: boolean }) => item.read)).toEqual([true, false, false]);
  });

  it('refuses a malformed cursor with 400', async () => {
    const res = await call('GET', '/v1/me/notifications?cursor=not-a-cursor');

    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe(ErrorCodes.INVALID_CURSOR);
  });

  it('counts what is unread for the caller only', async () => {
    expect((await call('GET', '/v1/me/notifications/unread-count')).json()).toEqual({
      unreadCount: 3,
    });
    expect((await call('GET', '/v1/me/notifications/unread-count', 'stranger')).json()).toEqual({
      unreadCount: 1,
    });
  });

  it('marks ids as read and answers with what is left', async () => {
    const [newest] = await idsOf();

    const res = await call('POST', '/v1/me/notifications/read', 'owner', { ids: [newest] });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ unreadCount: 2 });
  });

  it('marks everything as read, and tells the user stream so other devices clear their badge', async () => {
    const res = await call('POST', '/v1/me/notifications/read', 'owner', { all: true });

    expect(res.json()).toEqual({ unreadCount: 0 });
    const announced = expectOk(await ctx.repositories.userEvents.listFrom(SEEDED.userId, 0, 50));
    expect(announced.at(-1)).toMatchObject({
      type: 'notification.read',
      payload: { scope: 'all', unreadCount: 0 },
    });
  });

  it("refuses a request that names someone else's notification with 403 and reads nothing", async () => {
    const [mine] = await idsOf();
    const [theirs] = await idsOf('stranger');

    const res = await call('POST', '/v1/me/notifications/read', 'owner', { ids: [mine, theirs] });

    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe(ErrorCodes.FORBIDDEN);
    expect((await call('GET', '/v1/me/notifications/unread-count')).json()).toEqual({
      unreadCount: 3,
    });
    expect((await call('GET', '/v1/me/notifications/unread-count', 'stranger')).json()).toEqual({
      unreadCount: 1,
    });
  });

  it('skips an id that is gone', async () => {
    const res = await call('POST', '/v1/me/notifications/read', 'owner', { ids: [VIDEOS[0]] });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ unreadCount: 3 });
  });

  it.each([{}, { ids: [] }, { all: false }, { ids: ['nope'] }])(
    'refuses the body %j with 400',
    async (payload) => {
      const res = await call('POST', '/v1/me/notifications/read', 'owner', payload);

      expect(res.statusCode).toBe(400);
    }
  );
});
