import { expectOk } from '@kit/testing/result';
import { Adapters } from '@vp/adapters/composition';
import { VIEWER_SESSION_HEADER } from '@vp/api-contracts';
import { mintToken } from '@vp/dev-identity';
import { ErrorCodes } from '@vp/errors';
import {
  type TestApp,
  bearer,
  buildTestApp,
  seedTeamMember,
  seedVideo,
} from '../../__tests__/test-app';

const OWNER = '11111111-1111-7111-8111-1111111111a1';
const EDITOR = '22222222-2222-7222-8222-2222222222a2';
const MODERATOR = '33333333-3333-7333-8333-3333333333a3';
const STRANGER = '44444444-4444-7444-8444-4444444444a4';
const PRIVATE = '66666666-6666-7666-8666-6666666666a6';
const OTHER = '77777777-7777-7777-8777-7777777777a7';
const UNLISTED = '88888888-8888-7888-8888-8888888888a8';

const AS = {
  owner: bearer(mintToken({ sub: OWNER, role: 'CREATOR', ttl: '1h' })),
  editor: bearer(mintToken({ sub: EDITOR, role: 'USER', ttl: '1h' })),
  moderator: bearer(mintToken({ sub: MODERATOR, role: 'USER', ttl: '1h' })),
  stranger: bearer(mintToken({ sub: STRANGER, role: 'USER', ttl: '1h' })),
  anonymous: {},
};
type Who = keyof typeof AS;

describe('share link and password routes', () => {
  let ctx: TestApp;

  const call = (
    who: Who,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    url: string,
    payload?: object
  ) => ctx.app.inject({ method, url, headers: AS[who], ...(payload ? { payload } : {}) });
  const linksUrl = (videoId = PRIVATE) => `/v1/creator/videos/${videoId}/share-links`;
  const share = async (expiresIn = '24h', videoId = PRIVATE) =>
    (await call('owner', 'POST', linksUrl(videoId), { expiresIn, label: 'Press' })).json();
  const watch = (who: Who, videoId: string, token?: string) =>
    call(who, 'GET', `/v1/videos/${videoId}${token ? `?s=${token}` : ''}`);

  beforeAll(async () => {
    ctx = await buildTestApp();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  beforeEach(async () => {
    ctx.repositories.clear();
    for (const [id, visibility] of [
      [PRIVATE, 'private'],
      [OTHER, 'private'],
      [UNLISTED, 'unlisted'],
    ] as const) {
      await seedVideo(ctx.repositories, { id, ownerId: OWNER, title: 'Closed', visibility });
    }
    await seedTeamMember(ctx.repositories, { ownerId: OWNER, memberId: EDITOR, role: 'editor' });
    await seedTeamMember(ctx.repositories, {
      ownerId: OWNER,
      memberId: MODERATOR,
      role: 'moderator',
    });
  });

  describe('share links', () => {
    it('creates a link, lists it with its numbers and lets its holder watch the private video', async () => {
      const link = await share();

      const listed = await call('owner', 'GET', linksUrl());
      const watched = await watch('anonymous', PRIVATE, link.token);

      expect(link).toMatchObject({
        label: 'Press',
        state: 'active',
        token: expect.stringMatching(/^[\w-]{22}$/),
      });
      expect(listed.json().items).toEqual([link]);
      expect([watched.statusCode, watched.json().shareLinkId]).toEqual([200, link.id]);
      expect(watched.headers['cache-control']).toBe('private, no-cache');
      expect(watched.headers.vary).toBe('Authorization, Cookie, x-viewer-session');
    });

    it('stops at its expiry with 410', async () => {
      const token = 'expiredexpiredexpired0';
      expectOk(
        await ctx.repositories.shareLinks.create(
          {
            id: '99999999-9999-7999-8999-9999999999a9',
            targetType: 'video',
            targetId: PRIVATE,
            token,
            label: null,
            expiresAt: new Date(Date.now() - 1000),
            createdBy: OWNER,
            revokedAt: null,
            createdAt: new Date(Date.now() - 3_600_000),
          },
          50
        )
      );

      const res = await watch('anonymous', PRIVATE, token);

      expect([res.statusCode, res.json().code]).toEqual([410, ErrorCodes.SHARE_LINK_EXPIRED]);
    });

    it('answers 410 from the request after a revoke, which answers 204', async () => {
      const link = await share();

      const revoked = await call('editor', 'DELETE', `${linksUrl()}/${link.id}`);
      const res = await watch('anonymous', PRIVATE, link.token);

      expect(revoked.statusCode).toBe(204);
      expect([res.statusCode, res.json().code]).toEqual([410, ErrorCodes.SHARE_LINK_EXPIRED]);
    });

    it('proves nothing on another video', async () => {
      const link = await share();

      const res = await watch('stranger', OTHER, link.token);

      expect([res.statusCode, res.json().code]).toEqual([404, ErrorCodes.VIDEO_NOT_FOUND]);
    });

    it.each([
      {
        name: 'post a comment',
        method: 'POST' as const,
        path: 'videos/:id/comments',
        body: { content: 'Hi' },
        refused: [404, ErrorCodes.VIDEO_NOT_FOUND],
      },
      {
        name: 'read the comments',
        method: 'GET' as const,
        path: 'videos/:id/comments',
        refused: [404, ErrorCodes.VIDEO_NOT_FOUND],
      },
      {
        name: 'react',
        method: 'PUT' as const,
        path: 'videos/:id/reactions',
        body: { type: 'LIKE' },
        refused: [403, ErrorCodes.FORBIDDEN],
      },
      {
        name: 'read the stats',
        method: 'GET' as const,
        path: 'creator/videos/:id/analytics',
        refused: [404, ErrorCodes.VIDEO_NOT_FOUND],
      },
    ])('lets its holder watch and not $name', async ({ method, path, body, refused }) => {
      const link = await share();
      const url = `/v1/${path.replace(':id', PRIVATE)}?s=${link.token}`;

      const res = await call('stranger', method, url, body);

      expect((await watch('stranger', PRIVATE, link.token)).statusCode).toBe(200);
      expect([res.statusCode, res.json().code]).toEqual(refused);
    });

    it('counts opens of a tab with a session key, views and watch seconds per link through the flush', async () => {
      const link = await share();
      await watch('anonymous', PRIVATE, link.token);
      await ctx.app.inject({
        method: 'GET',
        url: `/v1/videos/${PRIVATE}?s=${link.token}`,
        headers: { [VIEWER_SESSION_HEADER]: 'a-tab-session-key-0001' },
      });
      await ctx.app.inject({
        method: 'POST',
        url: '/v1/telemetry/playback',
        payload: {
          videoId: PRIVATE,
          sessionUuid: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
          eventType: 'playback_ended',
          currentTime: 30,
          duration: 30,
          watchedSeconds: 30,
          shareLinkId: link.id,
        },
      });

      const batch = expectOk(await ctx.container.get(Adapters.ViewBuffer).snapshot('flush'));
      if (batch) expectOk(await ctx.repositories.videoViews.applyBatch(batch));
      const [listed] = (await call('owner', 'GET', linksUrl())).json().items;

      expect(listed.stats).toEqual({ opens: 1, views: 1, watchSeconds: 30 });
    });

    it('refuses a 51st active link with 409', async () => {
      for (let made = 0; made < 50; made += 1) await share();

      const res = await call('owner', 'POST', linksUrl(), { expiresIn: '1h' });

      expect([res.statusCode, res.json().code]).toEqual([409, ErrorCodes.SHARE_LINK_LIMIT]);
    });
  });

  describe('passwords', () => {
    const setPassword = (who: Who, password = 'open sesame', videoId = UNLISTED) =>
      call(who, 'PUT', `/v1/creator/videos/${videoId}/password`, { password });

    it('protects an unlisted video and gates its read until the password is removed', async () => {
      const set = await setPassword('editor');
      const gated = await watch('anonymous', UNLISTED);
      const cleared = await call('owner', 'DELETE', `/v1/creator/videos/${UNLISTED}/password`);
      const open = await watch('anonymous', UNLISTED);

      expect([set.statusCode, set.json()]).toEqual([200, { passwordProtected: true }]);
      expect([gated.statusCode, gated.json().code]).toEqual([
        403,
        ErrorCodes.VIDEO_PASSWORD_REQUIRED,
      ]);
      expect(cleared.statusCode).toBe(204);
      expect([open.statusCode, open.json().passwordProtected]).toEqual([200, false]);
    });

    it('lets the owner and a live link past the gate', async () => {
      await setPassword('owner');
      const link = await share('24h', UNLISTED);

      expect((await watch('owner', UNLISTED)).json().passwordProtected).toBe(true);
      expect((await watch('anonymous', UNLISTED, link.token)).statusCode).toBe(200);
    });

    it('refuses a password on a public video with 422', async () => {
      await seedVideo(ctx.repositories, { id: OTHER, ownerId: OWNER, title: 'Open' });

      const res = await setPassword('owner', 'open sesame', OTHER);

      expect([res.statusCode, res.json().code]).toEqual([422, ErrorCodes.VALIDATION_FAILED]);
    });
  });

  it.each([
    { who: 'editor' as const, status: [200, 201, 204, 200] },
    { who: 'moderator' as const, status: [403, 403, 403, 403] },
    { who: 'stranger' as const, status: [404, 404, 404, 403] },
    { who: 'anonymous' as const, status: [401, 401, 401, 401] },
  ])('answers $who with $status', async ({ who, status }) => {
    const responses = [
      await call(who, 'GET', linksUrl()),
      await call(who, 'POST', linksUrl(), { expiresIn: '1h' }),
      await call(who, 'DELETE', `/v1/creator/videos/${PRIVATE}/password`),
      await call(who, 'PUT', `/v1/creator/videos/${UNLISTED}/password`, {
        password: 'open sesame',
      }),
    ];

    expect(responses.map((res) => res.statusCode)).toEqual(status);
  });
});
