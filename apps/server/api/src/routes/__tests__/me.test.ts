import type { InMemoryRepositories } from '@vp/adapters/in-memory';
import type { StorageClient } from '@vp/core/ports';
import { mintToken } from '@vp/dev-token';
import { ErrorCodes } from '@vp/errors';
import type { FastifyInstance } from 'fastify';
import { bearer, buildTestApp } from '../../__tests__/test-app';

const USER = '00000000-0000-7000-8000-000000000077';

const AVATAR_REQUEST = { kind: 'avatar', contentType: 'image/png', sizeBytes: 2048 };

describe('me routes', () => {
  let app: FastifyInstance;
  let repositories: InMemoryRepositories;
  let storage: StorageClient;
  const token = mintToken({ sub: USER, role: 'user', ttl: '1h' });
  const auth = bearer(token);

  beforeAll(async () => {
    ({ app, repositories, storage } = await buildTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    repositories.clear();
  });

  it.each([
    { method: 'GET' as const, url: '/v1/me/account', payload: undefined },
    { method: 'PATCH' as const, url: '/v1/me/channel', payload: { displayName: 'Anyone' } },
    { method: 'POST' as const, url: '/v1/me/channel/images', payload: AVATAR_REQUEST },
  ])('refuses an anonymous $method $url with 401', async ({ method, url, payload }) => {
    const res = await app.inject({ method, url, ...(payload ? { payload } : {}) });

    expect(res.statusCode).toBe(401);
    expect(res.json().code).toBe(ErrorCodes.UNAUTHORIZED);
  });

  it('serves the caller account together with its channel', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/me/account', headers: auth });

    expect(res.statusCode).toBe(200);
    expect(res.json().user.id).toBe(USER);
    expect(res.json().channel.userId).toBe(USER);
  });

  it('keeps the captions default on the owner view and off the public channel', async () => {
    const account = await app.inject({ method: 'GET', url: '/v1/me/account', headers: auth });
    const { handle } = account.json().channel;
    expect(account.json().channel.autoCaptionsDefault).toBe(false);

    await app.inject({
      method: 'PUT',
      url: '/v1/me/channel/auto-captions',
      headers: auth,
      payload: { enabled: true },
    });
    const own = await app.inject({ method: 'GET', url: '/v1/me/account', headers: auth });
    const publicView = await app.inject({ method: 'GET', url: `/v1/channels/${handle}` });

    expect(own.json().channel.autoCaptionsDefault).toBe(true);
    expect(publicView.json()).not.toHaveProperty('autoCaptionsDefault');
  });

  it.each([
    { claim: 'user', role: 'USER' },
    { claim: 'creator', role: 'CREATOR' },
    { claim: 'admin', role: 'ADMIN' },
    { claim: 'superuser', role: 'GUEST' },
  ])('reports the role the verified token claims, $claim as $role', async ({ claim, role }) => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/me/account',
      headers: bearer(mintToken({ sub: USER, role: claim, ttl: '1h' })),
    });

    expect(res.json().role).toBe(role);
  });

  it('updates the caller channel and answers with the new state', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/v1/me/channel',
      headers: auth,
      payload: { displayName: 'Renamed', bio: 'New bio' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ userId: USER, displayName: 'Renamed', bio: 'New bio' });
  });

  it('saves three links, and the account then lists them', async () => {
    const links = [
      { label: 'Shop', url: 'https://shop.example.com' },
      { label: 'Blog', url: 'https://blog.example.com' },
      { label: 'Socials', url: 'https://social.example.com/me' },
    ];

    const patched = await app.inject({
      method: 'PATCH',
      url: '/v1/me/channel',
      headers: auth,
      payload: { links },
    });
    const account = await app.inject({ method: 'GET', url: '/v1/me/account', headers: auth });

    expect(patched.statusCode).toBe(200);
    const listed = links.map((link) => ({ ...link, platform: 'website' }));
    expect(patched.json().links).toEqual(listed);
    expect(account.json().channel.links).toEqual(listed);
  });

  it.each([
    { name: 'a non-https link', links: [{ label: 'Site', url: 'http://example.com' }] },
    {
      name: 'a ninth link',
      links: Array.from({ length: 9 }, (_, i) => ({ label: `L${i}`, url: `https://e.com/${i}` })),
    },
  ])('refuses $name as a 422 problem naming the links field', async ({ links }) => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/v1/me/channel',
      headers: auth,
      payload: { links },
    });

    expect(res.statusCode).toBe(422);
    expect(res.json()).toMatchObject({ code: ErrorCodes.VALIDATION_FAILED });
  });

  it('maps a handle the rule rejects to a 400 problem', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/v1/me/channel',
      headers: auth,
      payload: { handle: 'ab' },
    });

    expect(res.statusCode).toBe(400);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.json().code).toBe(ErrorCodes.INVALID_HANDLE_FORMAT);
  });

  describe('channel images', () => {
    const presign = (payload: object = AVATAR_REQUEST) =>
      app.inject({ method: 'POST', url: '/v1/me/channel/images', headers: auth, payload });

    const uploaded = async (key: string) => {
      await storage.uploadObject({
        bucket: 'public',
        key,
        body: Buffer.from('x'),
        contentType: 'image/png',
      });
      return key;
    };

    it("presigns an upload under the caller's own channel and saves the key it returned", async () => {
      const issued = await presign();
      const { key, uploadUrl } = issued.json();
      await uploaded(key);

      const saved = await app.inject({
        method: 'PATCH',
        url: '/v1/me/channel',
        headers: auth,
        payload: { avatarKey: key },
      });

      expect(issued.statusCode).toBe(201);
      expect(uploadUrl).toContain(key);
      expect(saved.statusCode).toBe(200);
      expect(saved.json().avatarUrl).toMatch(new RegExp(`/${key}$`));
      expect(key).toMatch(/^channels\/[\w-]+\/avatar\/[\w-]+\.png$/);
    });

    it.each([
      {
        name: 'a gif',
        payload: { ...AVATAR_REQUEST, contentType: 'image/gif' },
        code: ErrorCodes.UNSUPPORTED_CONTENT_TYPE,
      },
      {
        name: 'an oversized avatar',
        payload: { ...AVATAR_REQUEST, sizeBytes: 6 * 1024 * 1024 },
        code: ErrorCodes.UPLOAD_TOO_LARGE,
      },
    ])('refuses $name with $code', async ({ payload, code }) => {
      const res = await presign(payload);

      expect(res.statusCode).toBe(422);
      expect(res.json().code).toBe(code);
    });

    it.each([
      { name: 'another channel', key: 'channels/someone-else/avatar/a.png' },
      { name: 'nothing uploaded', key: 'channels/self/avatar/a.png' },
    ])('refuses a key of $name when saving the channel', async ({ key }) => {
      const channelId = (
        await app.inject({ method: 'GET', url: '/v1/me/account', headers: auth })
      ).json().channel.id;

      const res = await app.inject({
        method: 'PATCH',
        url: '/v1/me/channel',
        headers: auth,
        payload: { avatarKey: key.replace('self', channelId) },
      });

      expect(res.json().code).toBe(ErrorCodes.VALIDATION_FAILED);
    });
  });
});
