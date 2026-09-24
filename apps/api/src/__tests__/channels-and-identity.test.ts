import {
  InMemoryCacheClient,
  InMemoryRepositories,
  InMemoryStorageClient,
} from '@vp/adapters/in-memory';
import { mintToken } from '@vp/dev-token';
import { inProcessAppConfig } from '@vp/env-schema';
import { ErrorCodes } from '@vp/errors';
import { expectOk } from '@vp/testing/result';
import type { FastifyInstance } from 'fastify';
import { composeApp } from '../app';

describe('user and channel identity profile with universal auth', () => {
  let app: FastifyInstance;
  let repositories: InMemoryRepositories;
  let cache: InMemoryCacheClient;
  let storage: InMemoryStorageClient;

  const DEV_USER_ID = '00000000-0000-7000-8000-000000000001';
  let devToken: string;

  beforeAll(async () => {
    devToken = mintToken({ sub: DEV_USER_ID, role: 'user', ttl: '1h' });

    repositories = new InMemoryRepositories();
    cache = new InMemoryCacheClient();
    storage = new InMemoryStorageClient();

    app = (
      await composeApp({
        config: inProcessAppConfig(),
        adapters: {
          repositories,
          cache,
          storage,
        },
      })
    ).app;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    repositories.clear();
    cache.clear();
  });

  describe('JIT (Just-In-Time) User & Channel Provisioning Hook', () => {
    it('auto-provisions user and default channel on first authenticated request', async () => {
      const NEW_USER_ID = '00000000-0000-7000-8000-000000000099';
      const newToken = mintToken({
        sub: NEW_USER_ID,
        role: 'user',
        ttl: '1h',
      });

      expect(expectOk(await repositories.users.findById(NEW_USER_ID))).toBeNull();
      expect(expectOk(await repositories.channels.findByUserId(NEW_USER_ID))).toBeNull();

      const response = await app.inject({
        method: 'GET',
        url: '/v1/me/account',
        headers: {
          authorization: `Bearer ${newToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.user).toBeDefined();
      expect(body.user.id).toBe(NEW_USER_ID);
      expect(body.user.email).toBe(`${NEW_USER_ID}@taitube.local`);
      expect(body.email).toBe(body.user.email);

      expect(body.channel).toBeDefined();
      expect(body.channel.userId).toBe(NEW_USER_ID);
      expect(body.channel.handle).toBeDefined();
      expect(body.channel.displayName).toBeDefined();
      expect(body.channel.subscriberCount).toBe(0);

      const dbUser = expectOk(await repositories.users.findById(NEW_USER_ID));
      expect(dbUser).not.toBeNull();
      const dbChannel = expectOk(await repositories.channels.findByUserId(NEW_USER_ID));
      expect(dbChannel).not.toBeNull();
      expect(dbChannel?.handle).toBe(body.channel.handle);
    });
  });

  describe('GET /v1/me/account', () => {
    it('returns authenticated user profile and channel profile', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/me/account',
        headers: {
          authorization: `Bearer ${devToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.id).toBe(DEV_USER_ID);
      expect(body.email).toBe('dev@video-pipeline.local');
      expect(body.user.id).toBe(DEV_USER_ID);
      expect(body.channel.userId).toBe(DEV_USER_ID);
      expect(body.channel.handle).toBe('dev');
      expect(body.channel.displayName).toBe('Dev Channel');
      expect(body.channel.subscriberCount).toBe(42);
    });

    it('rejects unauthenticated request with 401 UNAUTHORIZED', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/me/account',
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.code).toBe(ErrorCodes.UNAUTHORIZED);
    });
  });

  describe('PATCH /v1/me/channel', () => {
    it('updates channel display name, avatar, banner, and bio', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/v1/me/channel',
        headers: {
          authorization: `Bearer ${devToken}`,
          'content-type': 'application/json',
        },
        payload: {
          displayName: 'Updated Dev Name',
          bio: 'Updated channel bio description',
          avatarUrl: 'https://example.com/avatar.png',
          bannerUrl: 'https://example.com/banner.jpg',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.displayName).toBe('Updated Dev Name');
      expect(body.bio).toBe('Updated channel bio description');
      expect(body.avatarUrl).toBe('https://example.com/avatar.png');
      expect(body.bannerUrl).toBe('https://example.com/banner.jpg');
      expect(body.handle).toBe('dev');

      const inDb = expectOk(await repositories.channels.findByUserId(DEV_USER_ID));
      expect(inDb?.displayName).toBe('Updated Dev Name');
      expect(inDb?.bio).toBe('Updated channel bio description');
    });

    it('updates channel handle with lowercase sanitization', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/v1/me/channel',
        headers: {
          authorization: `Bearer ${devToken}`,
          'content-type': 'application/json',
        },
        payload: {
          handle: 'Dev_Channel_New',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.handle).toBe('dev_channel_new');

      const publicRes = await app.inject({
        method: 'GET',
        url: '/v1/channels/@dev_channel_new',
      });
      expect(publicRes.statusCode).toBe(200);
      const publicBody = JSON.parse(publicRes.body);
      expect(publicBody.userId).toBe(DEV_USER_ID);
    });

    it.each([
      {
        name: 'a handle under the minimum length',
        handle: 'ab',
        status: 400,
        code: ErrorCodes.INVALID_HANDLE_FORMAT,
      },
      {
        name: 'a reserved handle',
        handle: 'studio',
        status: 409,
        code: ErrorCodes.HANDLE_ALREADY_TAKEN,
      },
      {
        name: 'a handle another channel already holds',
        handle: 'user',
        status: 409,
        code: ErrorCodes.HANDLE_ALREADY_TAKEN,
      },
    ])('rejects $name with $status $code', async ({ handle, status, code }) => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/v1/me/channel',
        headers: {
          authorization: `Bearer ${devToken}`,
          'content-type': 'application/json',
        },
        payload: { handle },
      });

      expect(response.statusCode).toBe(status);
      const body = JSON.parse(response.body);
      expect(body.code).toBe(code);
    });
  });

  describe('GET /v1/channels/:idOrHandle', () => {
    it.each([{ idOrHandle: 'dev' }, { idOrHandle: '@dev' }])(
      'retrieves creator profile by $idOrHandle without authentication',
      async ({ idOrHandle }) => {
        const response = await app.inject({
          method: 'GET',
          url: `/v1/channels/${idOrHandle}`,
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body.userId).toBe(DEV_USER_ID);
        expect(body.handle).toBe('dev');
        expect(body.subscriberCount).toBe(42);
      }
    );

    it('retrieves creator profile by channel UUID without authentication', async () => {
      const devChannel = expectOk(await repositories.channels.findByUserId(DEV_USER_ID));
      expect(devChannel).not.toBeNull();

      const response = await app.inject({
        method: 'GET',
        url: `/v1/channels/${devChannel?.id}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.id).toBe(devChannel?.id);
      expect(body.handle).toBe('dev');
    });

    it('returns 404 CHANNEL_NOT_FOUND for non-existent channel', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/channels/@ghost_creator',
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.code).toBe(ErrorCodes.CHANNEL_NOT_FOUND);
    });
  });

  describe('OpenAPI Documentation', () => {
    it('serves openapi spec with /v1/me/account, /v1/me/channel, and /v1/channels/:idOrHandle', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/openapi.json',
      });

      expect(response.statusCode).toBe(200);
      const spec = JSON.parse(response.body);
      expect(spec.paths['/v1/me/account']).toBeDefined();
      expect(spec.paths['/v1/me/account'].get).toBeDefined();
      expect(spec.paths['/v1/me/channel']).toBeDefined();
      expect(spec.paths['/v1/me/channel'].patch).toBeDefined();
      expect(spec.paths['/v1/channels/{idOrHandle}']).toBeDefined();
      expect(spec.paths['/v1/channels/{idOrHandle}'].get).toBeDefined();
    });
  });
});
