import type { APIRequestContext } from '@playwright/test';
import { API_SCOPES } from '@vp/domain';
import { type Stack, expect, test as base } from '../../../../../tests/playwright/fixtures';
import type { Persona } from '../../../../../tests/playwright/stack';

const NO_ID = '00000000-0000-7000-8000-000000000000';

type TokenAttempt = {
  name: string;
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: (stack: Stack) => string;
  data?: Record<string, unknown>;
  status: number;
  code: string;
};

/** Routes no scope names: a token is refused them however many scopes it holds. */
const OUT_OF_REACH: TokenAttempt[] = [
  {
    name: 'create a token',
    method: 'POST',
    path: () => '/v1/me/api-tokens',
    data: { name: 'child', scopes: ['videos:read'] },
    status: 403,
    code: 'API_TOKEN_SCOPE_MISSING',
  },
  {
    name: 'change the handle',
    method: 'PATCH',
    path: () => '/v1/me/channel',
    data: { handle: 'hijacked' },
    status: 403,
    code: 'API_TOKEN_SCOPE_MISSING',
  },
  {
    name: 'invite a member',
    method: 'POST',
    path: () => '/v1/me/channel/invites',
    data: { handle: 'nobody', role: 'manager' },
    status: 403,
    code: 'API_TOKEN_SCOPE_MISSING',
  },
  {
    name: 'remove a member',
    method: 'DELETE',
    path: () => `/v1/me/channel/members/${NO_ID}`,
    status: 403,
    code: 'API_TOKEN_SCOPE_MISSING',
  },
  {
    name: 'read the dead letter queue',
    method: 'GET',
    path: () => '/v1/admin/dlq',
    status: 403,
    code: 'API_TOKEN_SCOPE_MISSING',
  },
];

/** Routes the scope covers, where the token is still no more than its user: the intersection. */
const BEYOND_THE_USER: (TokenAttempt & { persona: Persona })[] = [
  {
    name: "edit the creator's video as the channel's analytics viewer",
    persona: 'analytics',
    method: 'PATCH',
    path: ({ videos }) => `/v1/videos/${videos.watchable.id}`,
    data: { title: 'hijacked', version: 1 },
    status: 403,
    code: 'FORBIDDEN',
  },
  {
    name: "export the comments as the channel's analytics viewer",
    persona: 'analytics',
    method: 'POST',
    path: () => '/v1/me/channel/exports',
    data: { kind: 'comments', format: 'csv' },
    status: 403,
    code: 'FORBIDDEN',
  },
  {
    name: "edit a video as the channel's moderator",
    persona: 'moderator',
    method: 'PATCH',
    path: ({ videos }) => `/v1/creator/videos/${videos.watchable.id}`,
    data: { title: 'hijacked', version: 1 },
    status: 403,
    code: 'FORBIDDEN',
  },
];

const test = base.extend<{
  mint: (
    persona: Persona,
    options?: { channelId?: string; scopes?: readonly string[] }
  ) => Promise<string>;
  bearer: (token: string, extraHeaders?: Record<string, string>) => Promise<APIRequestContext>;
}>({
  mint: async ({ api }, provide) => {
    const minted: { session: APIRequestContext; id: string }[] = [];
    await provide(async (persona, { channelId, scopes = API_SCOPES } = {}) => {
      const session = await api(persona, { channelId });
      const created = await session.post('/v1/me/api-tokens', {
        data: { name: 'escalation', scopes },
      });
      expect(created.status()).toBe(201);
      const { id, token } = await created.json();
      minted.push({ session, id });
      return token;
    });
    for (const { session, id } of minted) {
      expect((await session.delete(`/v1/me/api-tokens/${id}`)).status()).toBe(204);
    }
  },
  bearer: async ({ playwright, stack }, provide) => {
    const contexts: APIRequestContext[] = [];
    await provide(async (token, extraHeaders = {}) => {
      const context = await playwright.request.newContext({
        baseURL: stack.apiUrl,
        extraHTTPHeaders: { authorization: `Bearer ${token}`, ...extraHeaders },
      });
      contexts.push(context);
      return context;
    });
    await Promise.all(contexts.map((context) => context.dispose()));
  },
});

test.describe('a personal access token never does more than its user', () => {
  for (const attempt of OUT_OF_REACH) {
    test(`a creator's token holding every scope cannot ${attempt.name}`, async ({
      mint,
      bearer,
      stack,
    }) => {
      const token = await bearer(await mint('creator'));

      const response = await token.fetch(attempt.path(stack), {
        method: attempt.method,
        data: attempt.data,
      });

      expect(response.status()).toBe(attempt.status);
      expect(await response.json()).toMatchObject({ code: attempt.code });
    });
  }

  for (const { persona, ...attempt } of BEYOND_THE_USER) {
    test(`a ${persona}'s token holding every scope cannot ${attempt.name}`, async ({
      mint,
      bearer,
      stack,
    }) => {
      const token = await bearer(await mint(persona, { channelId: stack.team.channelId }));

      const response = await token.fetch(attempt.path(stack), {
        method: attempt.method,
        data: attempt.data,
      });

      expect(response.status()).toBe(attempt.status);
      expect(await response.json()).toMatchObject({ code: attempt.code });
    });
  }

  test('a token request is refused with a session cookie beside it', async ({ mint, bearer }) => {
    const both = await bearer(await mint('creator', { scopes: ['videos:read'] }), {
      cookie: 'vp.session=anything',
    });

    const response = await both.get('/v1/videos');

    expect(response.status()).toBe(400);
    expect(await response.json()).toMatchObject({ code: 'API_TOKEN_WITH_SESSION' });
  });

  test('a revoked token is a 401 on its next request', async ({ api, stack, playwright }) => {
    const session = await api('creator');
    const created = await (
      await session.post('/v1/me/api-tokens', {
        data: { name: 'revoked', scopes: ['videos:read'] },
      })
    ).json();
    expect((await session.delete(`/v1/me/api-tokens/${created.id}`)).status()).toBe(204);
    const token = await playwright.request.newContext({
      baseURL: stack.apiUrl,
      extraHTTPHeaders: { authorization: `Bearer ${created.token}` },
    });

    expect((await token.get('/v1/videos')).status()).toBe(401);
    await token.dispose();
  });
});
