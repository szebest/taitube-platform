import { expectOk } from '@kit/testing/result';
import type { InMemoryRepositories } from '@vp/adapters/in-memory';
import { CHANNEL_HEADER } from '@vp/api-contracts';
import { type ApiScope, formatApiToken } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { SEEDED } from '@vp/testing-fixtures';
import type { FastifyInstance, InjectOptions } from 'fastify';
import { nodeApiTokenSecrets } from '../composition/api-token-secrets';
import { TOKENS, bearer, buildTestApp, seedTeamMember, seedVideo } from './test-app';

const VIDEO_ID = '00000000-0000-7000-8000-0000000019b1';
const NO_ID = '00000000-0000-7000-8000-0000000019b9';

describe('personal access tokens, end to end', () => {
  let app: FastifyInstance;
  let repositories: InMemoryRepositories;

  const call = (headers: Record<string, string>, options: InjectOptions) =>
    app.inject({ ...options, headers: { ...headers, ...options.headers } });

  async function tokenFor(
    scopes: ApiScope[],
    session = TOKENS.user,
    channelId?: string
  ): Promise<{ id: string; headers: Record<string, string> }> {
    const res = await call(bearer(session), {
      method: 'POST',
      url: '/v1/me/api-tokens',
      payload: { name: 'script', scopes },
      ...(channelId && { headers: { [CHANNEL_HEADER]: channelId } }),
    });
    expect(res.statusCode).toBe(201);
    const { id, token } = res.json();
    return { id, headers: bearer(token) };
  }

  const ownChannelId = async () =>
    expectOk(await repositories.channels.findPrimaryByUserId(SEEDED.userId))?.id ?? '';

  beforeAll(async () => {
    ({ app, repositories } = await buildTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    repositories.clear();
    await seedVideo(repositories, { id: VIDEO_ID, ownerId: SEEDED.userId, title: 'Before' });
  });

  it('shows the token once: the list never carries it', async () => {
    await tokenFor(['videos:read']);

    const listed = await call(bearer(TOKENS.user), { method: 'GET', url: '/v1/me/api-tokens' });

    expect(listed.statusCode).toBe(200);
    expect(listed.json().items).toEqual([
      expect.objectContaining({ name: 'script', scopes: ['videos:read'], status: 'active' }),
    ]);
    expect(listed.body).not.toContain('tt_pat_');
  });

  it('reads analytics with analytics:read, and is refused a comment delete', async () => {
    const { headers } = await tokenFor(['analytics:read']);

    const read = await call(headers, { method: 'GET', url: '/v1/creator/channel/analytics' });
    const removed = await call(headers, { method: 'DELETE', url: `/v1/comments/${NO_ID}` });

    expect(read.statusCode).toBe(200);
    expect([removed.statusCode, removed.json()]).toEqual([
      403,
      expect.objectContaining({ code: ErrorCodes.API_TOKEN_SCOPE_MISSING }),
    ]);
  });

  it('edits a video with videos:write, and the audit log names the member and the token', async () => {
    const { id, headers } = await tokenFor(['videos:write']);

    const edited = await call(headers, {
      method: 'PATCH',
      url: `/v1/creator/videos/${VIDEO_ID}`,
      payload: { title: 'After', version: 1 },
    });
    const audit = await call(bearer(TOKENS.user), { method: 'GET', url: '/v1/me/channel/audit' });

    expect([edited.statusCode, edited.json().title]).toEqual([200, 'After']);
    expect(audit.json().items).toEqual([
      expect.objectContaining({
        action: 'video.updated',
        actorUserId: SEEDED.userId,
        actorTokenId: id,
      }),
    ]);
  });

  it('publishes a post with posts:write, and the audit log names the member and the token', async () => {
    const { id, headers } = await tokenFor(['posts:write']);

    const published = await call(headers, {
      method: 'POST',
      url: '/v1/me/channel/posts',
      payload: { payload: { kind: 'text', text: 'from a script' } },
    });
    const audit = await call(bearer(TOKENS.user), { method: 'GET', url: '/v1/me/channel/audit' });

    expect([published.statusCode, published.json().body]).toEqual([
      201,
      { kind: 'text', text: 'from a script' },
    ]);
    expect(audit.json().items).toEqual([
      expect.objectContaining({
        action: 'post.published',
        actorUserId: SEEDED.userId,
        actorTokenId: id,
      }),
    ]);
  });

  it.each([
    {
      method: 'POST',
      url: '/v1/me/channel/posts',
      payload: { payload: { kind: 'text', text: 'x' } },
    },
    {
      method: 'PATCH',
      url: `/v1/me/channel/posts/${NO_ID}`,
      payload: { payload: { kind: 'text', text: 'x' }, version: 1 },
    },
    { method: 'DELETE', url: `/v1/me/channel/posts/${NO_ID}` },
  ] as const)('refuses a token without posts:write on $method $url with 403', async (options) => {
    const { headers } = await tokenFor(['videos:write', 'comments:read']);

    const res = await call(headers, options);

    expect([res.statusCode, res.json().code]).toEqual([403, ErrorCodes.API_TOKEN_SCOPE_MISSING]);
  });

  it('answers a malformed, a revoked and an expired token with 401', async () => {
    const revoked = await tokenFor(['videos:read']);
    await call(bearer(TOKENS.user), { method: 'DELETE', url: `/v1/me/api-tokens/${revoked.id}` });
    const parts = nodeApiTokenSecrets.mint();
    expectOk(
      await repositories.apiTokens.create({
        id: NO_ID,
        userId: SEEDED.userId,
        channelId: await ownChannelId(),
        name: 'old',
        prefix: parts.prefix,
        secretHash: nodeApiTokenSecrets.hash(parts.secret),
        scopes: ['videos:read'],
        expiresAt: new Date(Date.now() - 1000),
        lastUsedAt: null,
        revokedAt: null,
        createdAt: new Date(Date.now() - 86_400_000),
      })
    );

    const answers = await Promise.all(
      [bearer('tt_pat_nope'), revoked.headers, bearer(formatApiToken(parts))].map(
        async (headers) => (await call(headers, { method: 'GET', url: '/v1/videos' })).statusCode
      )
    );

    expect(answers).toEqual([401, 401, 401]);
  });

  it('refuses a request that carries a token and a session cookie with 400', async () => {
    const { headers } = await tokenFor(['videos:read']);

    const res = await call(
      { ...headers, cookie: `theme=sand; vp.session=${TOKENS.user}` },
      { method: 'GET', url: '/v1/videos' }
    );

    expect([res.statusCode, res.json().code]).toEqual([400, ErrorCodes.API_TOKEN_WITH_SESSION]);
  });

  it.each<{ what: string; options: InjectOptions }>([
    {
      what: 'create a token',
      options: {
        method: 'POST',
        url: '/v1/me/api-tokens',
        payload: { name: 'n', scopes: ['videos:read'] },
      },
    },
    { what: 'list the tokens', options: { method: 'GET', url: '/v1/me/api-tokens' } },
    {
      what: 'change the handle',
      options: { method: 'PATCH', url: '/v1/me/channel', payload: { handle: 'hijacked' } },
    },
    {
      what: 'invite a member',
      options: {
        method: 'POST',
        url: '/v1/me/channel/invites',
        payload: { handle: 'nobody', role: 'manager' },
      },
    },
    {
      what: 'remove a member',
      options: { method: 'DELETE', url: `/v1/me/channel/members/${NO_ID}` },
    },
    { what: 'open the event stream', options: { method: 'GET', url: '/v1/me/events' } },
    {
      what: 'get a chat ticket',
      options: { method: 'POST', url: `/v1/live/${NO_ID}/chat/ticket` },
    },
  ])('cannot $what whatever its scopes', async ({ options }) => {
    const { headers } = await tokenFor([
      'videos:read',
      'videos:write',
      'analytics:read',
      'comments:read',
      'comments:moderate',
      'exports:read',
      'exports:create',
      'webhooks:manage',
      'posts:write',
    ]);

    const res = await call(headers, options);

    expect([res.statusCode, res.json().code]).toEqual([403, ErrorCodes.API_TOKEN_SCOPE_MISSING]);
  });

  it("stops a removed member's token on the next request", async () => {
    const channelId = await seedTeamMember(repositories, {
      ownerId: SEEDED.userId,
      memberId: SEEDED.otherUserId,
      role: 'analytics',
    });
    const { headers } = await tokenFor(['analytics:read'], TOKENS.otherUser, channelId);
    const read = () => call(headers, { method: 'GET', url: '/v1/creator/channel/analytics' });
    expect((await read()).statusCode).toBe(200);

    const removed = await call(bearer(TOKENS.user), {
      method: 'DELETE',
      url: `/v1/me/channel/members/${SEEDED.otherUserId}`,
    });

    expect(removed.statusCode).toBe(204);
    expect((await read()).statusCode).toBe(401);
  });

  it('acts on its own channel: an X-Channel-Id naming another is refused', async () => {
    const { headers } = await tokenFor(['analytics:read']);

    const res = await call(
      { ...headers, [CHANNEL_HEADER]: NO_ID },
      { method: 'GET', url: '/v1/creator/channel/analytics' }
    );

    expect([res.statusCode, res.json().code]).toEqual([
      403,
      ErrorCodes.CHANNEL_MEMBERSHIP_REQUIRED,
    ]);
  });

  it('registers a webhook for comment.held with webhooks:manage', async () => {
    const { headers } = await tokenFor(['webhooks:manage']);

    const res = await call(headers, {
      method: 'POST',
      url: '/v1/me/webhooks',
      payload: { url: 'https://hooks.example.com/held', events: ['comment.held'] },
    });

    expect([res.statusCode, res.json().events]).toEqual([201, ['comment.held']]);
  });
});
