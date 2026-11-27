import { expectOk } from '@kit/testing/result';
import type { InMemoryRepositories } from '@vp/adapters/in-memory';
import { mintToken } from '@vp/dev-identity';
import type { ChannelRole } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { SEEDED } from '@vp/testing-fixtures';
import type { FastifyInstance } from 'fastify';
import { TOKENS, bearer, buildTestApp, seedVideo } from '../../__tests__/test-app';

const PUBLIC_VIDEO = '33333333-3333-7333-8333-333333333341';
const PRIVATE_VIDEO = '33333333-3333-7333-8333-333333333342';
const ABSENT_VIDEO = '99999999-9999-7999-8999-999999999999';
const STATS_FIELDS = ['subscribersGained', 'lifetime', 'last30Days', 'first48Hours', 'retention'];

const MEMBERS: Record<ChannelRole, string> = {
  manager: '66666666-6666-7666-8666-666666666601',
  editor: '66666666-6666-7666-8666-666666666602',
  analytics: '66666666-6666-7666-8666-666666666603',
  moderator: '66666666-6666-7666-8666-666666666604',
};

describe('creator stats route', () => {
  let app: FastifyInstance;
  let repositories: InMemoryRepositories;

  const get = (url: string, token?: string) =>
    app.inject({ method: 'GET', url, headers: token ? bearer(token) : {} });
  const statsOf = (id: string, token?: string) => get(`/v1/videos/${id}/creator-stats`, token);

  beforeAll(async () => {
    ({ app, repositories } = await buildTestApp());
    await seedVideo(repositories, { id: PUBLIC_VIDEO, ownerId: SEEDED.userId, title: 'Open' });
    await seedVideo(repositories, {
      id: PRIVATE_VIDEO,
      ownerId: SEEDED.userId,
      title: 'Closed',
      visibility: 'private',
    });
    for (const [role, userId] of Object.entries(MEMBERS) as [ChannelRole, string][]) {
      expectOk(await repositories.users.upsert({ id: userId, email: `${role}@example.com` }));
      repositories.channelMembers.join({
        channelId: SEEDED.channelId,
        userId,
        role,
        invitedBy: SEEDED.userId,
        createdAt: new Date(),
      });
    }
  });

  afterAll(async () => {
    await app.close();
  });

  it('serves the owner the stats, never cached', async () => {
    const res = await statsOf(PUBLIC_VIDEO, TOKENS.user);

    expect(res.statusCode).toBe(200);
    expect(res.headers['cache-control']).toBe('private, no-store');
    expect(res.json()).toMatchObject({ videoId: PUBLIC_VIDEO, lifetime: { subscribersGained: 0 } });
  });

  it.each([
    {
      who: 'a guest',
      video: PUBLIC_VIDEO,
      token: undefined,
      status: 401,
      code: ErrorCodes.UNAUTHORIZED,
    },
    {
      who: 'a signed-in stranger',
      video: PUBLIC_VIDEO,
      token: TOKENS.otherUser,
      status: 403,
      code: ErrorCodes.FORBIDDEN,
    },
    {
      who: 'a stranger on a private video',
      video: PRIVATE_VIDEO,
      token: TOKENS.otherUser,
      status: 404,
      code: ErrorCodes.VIDEO_NOT_FOUND,
    },
    {
      who: 'the owner on an absent video',
      video: ABSENT_VIDEO,
      token: TOKENS.user,
      status: 404,
      code: ErrorCodes.VIDEO_NOT_FOUND,
    },
  ])('answers $who with $status', async ({ video, token, status, code }) => {
    const res = await statsOf(video, token);

    expect(res.statusCode).toBe(status);
    expect(res.json().code).toBe(code);
    expect(res.headers['cache-control']).toBe(status === 401 ? undefined : 'private, no-store');
  });

  it.each([
    { role: 'manager' as const, status: 200 },
    { role: 'editor' as const, status: 200 },
    { role: 'analytics' as const, status: 200 },
    { role: 'moderator' as const, status: 403 },
  ])('answers a team $role with $status', async ({ role, status }) => {
    const token = mintToken({ sub: MEMBERS[role], role: 'user', ttl: '1h' });

    expect((await statsOf(PUBLIC_VIDEO, token)).statusCode).toBe(status);
  });

  it.each([
    { surface: 'the public video resource', url: `/v1/videos/${PUBLIC_VIDEO}` },
    { surface: 'the owner video resource', url: `/v1/creator/videos/${PUBLIC_VIDEO}` },
  ])('keeps the stats out of $surface', async ({ url }) => {
    const body = (await get(url, TOKENS.user)).body;

    for (const field of STATS_FIELDS) expect(body).not.toContain(`"${field}"`);
  });
});
