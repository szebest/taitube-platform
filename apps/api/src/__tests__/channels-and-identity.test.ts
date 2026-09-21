import * as crypto from 'node:crypto';
import { InMemoryCacheClient, InMemoryRepositories, InMemoryStorageClient } from '@vp/adapters';
import { mintToken } from '@vp/dev-token';
import { ErrorCodes } from '@vp/errors';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../app';
import { type JwksKey, clearJwksCache, setCachedJwks } from '../plugins/jwks-verifier';

describe('User & Channel Identity Profile with Universal Auth (Ticket 38)', () => {
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

    app = await buildApp({
      adapters: {
        repositories,
        cache,
        storage,
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    repositories.clear();
    cache.clear();
    clearJwksCache();
  });

  describe('JIT (Just-In-Time) User & Channel Provisioning Hook', () => {
    it('auto-provisions user and default channel on first authenticated request', async () => {
      const NEW_USER_ID = '00000000-0000-7000-8000-000000000099';
      const newToken = mintToken({
        sub: NEW_USER_ID,
        role: 'user',
        ttl: '1h',
      });

      // Verify user and channel do not exist yet in DB
      expect(await repositories.users.findById(NEW_USER_ID)).toBeNull();
      expect(await repositories.channels.findByUserId(NEW_USER_ID)).toBeNull();

      // First authenticated request
      const response = await app.inject({
        method: 'GET',
        url: '/v1/me/account',
        headers: {
          authorization: `Bearer ${newToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      // Verify returned user structure
      expect(body.user).toBeDefined();
      expect(body.user.id).toBe(NEW_USER_ID);
      expect(body.user.email).toBe(`${NEW_USER_ID}@taitube.local`);
      expect(body.email).toBe(body.user.email);

      // Verify returned channel structure
      expect(body.channel).toBeDefined();
      expect(body.channel.userId).toBe(NEW_USER_ID);
      expect(body.channel.handle).toBeDefined();
      expect(body.channel.displayName).toBeDefined();
      expect(body.channel.subscriberCount).toBe(0);

      // Verify persistent in repositories
      const dbUser = await repositories.users.findById(NEW_USER_ID);
      expect(dbUser).not.toBeNull();
      const dbChannel = await repositories.channels.findByUserId(NEW_USER_ID);
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

      // Verify in DB
      const inDb = await repositories.channels.findByUserId(DEV_USER_ID);
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

      // Public lookup with new handle
      const publicRes = await app.inject({
        method: 'GET',
        url: '/v1/channels/@dev_channel_new',
      });
      expect(publicRes.statusCode).toBe(200);
      const publicBody = JSON.parse(publicRes.body);
      expect(publicBody.userId).toBe(DEV_USER_ID);
    });

    it('rejects invalid handle format with 400 INVALID_HANDLE_FORMAT', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/v1/me/channel',
        headers: {
          authorization: `Bearer ${devToken}`,
          'content-type': 'application/json',
        },
        payload: {
          handle: 'ab', // < 3 characters
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.code).toBe(ErrorCodes.INVALID_HANDLE_FORMAT);
    });

    it('rejects reserved handles with 409 HANDLE_ALREADY_TAKEN', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/v1/me/channel',
        headers: {
          authorization: `Bearer ${devToken}`,
          'content-type': 'application/json',
        },
        payload: {
          handle: 'studio',
        },
      });

      expect(response.statusCode).toBe(409);
      const body = JSON.parse(response.body);
      expect(body.code).toBe(ErrorCodes.HANDLE_ALREADY_TAKEN);
    });

    it('rejects conflicting existing handle with 409 HANDLE_ALREADY_TAKEN', async () => {
      // User 2 has handle 'user'
      const response = await app.inject({
        method: 'PATCH',
        url: '/v1/me/channel',
        headers: {
          authorization: `Bearer ${devToken}`,
          'content-type': 'application/json',
        },
        payload: {
          handle: 'user',
        },
      });

      expect(response.statusCode).toBe(409);
      const body = JSON.parse(response.body);
      expect(body.code).toBe(ErrorCodes.HANDLE_ALREADY_TAKEN);
    });
  });

  describe('GET /v1/channels/:idOrHandle', () => {
    it('retrieves creator profile by handle without authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/channels/dev',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.userId).toBe(DEV_USER_ID);
      expect(body.handle).toBe('dev');
      expect(body.subscriberCount).toBe(42);
    });

    it('retrieves creator profile by @handle prefix without authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/channels/@dev',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.userId).toBe(DEV_USER_ID);
      expect(body.handle).toBe('dev');
    });

    it('retrieves creator profile by channel UUID without authentication', async () => {
      const devChannel = await repositories.channels.findByUserId(DEV_USER_ID);
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

  describe('Universal OIDC / JWKS Verification', () => {
    it('verifies standard RS256 token against JWKS', async () => {
      // Generate standard RSA keypair
      const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
      });

      const publicJwk = publicKey.export({ format: 'jwk' });
      publicJwk.kid = 'rs256-test-key';
      publicJwk.alg = 'RS256';
      publicJwk.use = 'sig';

      setCachedJwks({
        keys: [publicJwk as unknown as JwksKey],
      });

      const header = {
        alg: 'RS256',
        typ: 'JWT',
        kid: 'rs256-test-key',
      };
      const now = Math.floor(Date.now() / 1000);
      const RS256_USER_ID = '00000000-0000-7000-8000-000000000088';
      const payload = {
        sub: RS256_USER_ID,
        email: 'clerk_user@example.com',
        role: 'user',
        iat: now,
        exp: now + 3600,
      };

      const encHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
      const encPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
      const data = `${encHeader}.${encPayload}`;
      const sig = crypto.sign('RSA-SHA256', Buffer.from(data), privateKey).toString('base64url');
      const rsaJwt = `${data}.${sig}`;

      // Call /v1/me/account with RS256 JWT
      const response = await app.inject({
        method: 'GET',
        url: '/v1/me/account',
        headers: {
          authorization: `Bearer ${rsaJwt}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.user.id).toBe(RS256_USER_ID);
      expect(body.user.email).toBe('clerk_user@example.com');
      expect(body.channel.userId).toBe(RS256_USER_ID);
      expect(body.channel.handle).toBe('clerk_user');
    });

    it('rejects expired RS256 token with 401 UNAUTHORIZED', async () => {
      const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
      });
      const publicJwk = publicKey.export({ format: 'jwk' });
      publicJwk.kid = 'rs256-expired-key';
      publicJwk.alg = 'RS256';

      setCachedJwks({
        keys: [publicJwk as unknown as JwksKey],
      });

      const header = { alg: 'RS256', typ: 'JWT', kid: 'rs256-expired-key' };
      const now = Math.floor(Date.now() / 1000);
      const payload = {
        sub: '00000000-0000-7000-8000-000000000077',
        iat: now - 7200,
        exp: now - 3600, // Expired 1 hour ago
      };

      const encHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
      const encPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
      const data = `${encHeader}.${encPayload}`;
      const sig = crypto.sign('RSA-SHA256', Buffer.from(data), privateKey).toString('base64url');
      const expiredJwt = `${data}.${sig}`;

      const response = await app.inject({
        method: 'GET',
        url: '/v1/me/account',
        headers: {
          authorization: `Bearer ${expiredJwt}`,
        },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.code).toBe(ErrorCodes.UNAUTHORIZED);
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
