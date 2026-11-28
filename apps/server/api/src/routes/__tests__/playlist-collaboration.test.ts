import { expectOk } from '@kit/testing/result';
import { ErrorCodes } from '@vp/errors';
import {
  ABSENT,
  CONTRIBUTOR,
  EDITOR,
  type LibraryApp,
  OWNER,
  VIDEOS,
  type Who,
  buildLibraryApp,
} from '../../__tests__/library-app';
import { seedPrimaryChannel } from '../../__tests__/test-app';

const [V0, V1] = VIDEOS;

describe('playlist collaboration routes', () => {
  let ctx: LibraryApp;
  let playlistId: string;

  const handleOf = async (userId: string) => {
    await seedPrimaryChannel(ctx.repositories, userId);
    return expectOk(await ctx.repositories.channels.findPrimaryByUserId(userId))?.handle ?? '';
  };

  const invite = async (userId: string, role: 'editor' | 'contributor') =>
    ctx.call('owner', 'POST', `/v1/playlists/${playlistId}/collaborators`, {
      handle: await handleOf(userId),
      role,
    });

  const seat = async (who: Who, userId: string, role: 'editor' | 'contributor') => {
    const { token } = (await invite(userId, role)).json();
    expect((await ctx.call(who, 'POST', `/v1/playlist-invites/${token}/accept`)).statusCode).toBe(
      200
    );
  };

  const link = async (body: Record<string, unknown>) =>
    (await ctx.call('owner', 'POST', `/v1/playlists/${playlistId}/invites`, body)).json().token;

  beforeEach(async () => {
    ctx = await buildLibraryApp();
    playlistId = await ctx.playlist('owner');
  });

  afterEach(async () => {
    await ctx.app.close();
  });

  it.each([
    { method: 'GET' as const, url: `/v1/playlists/${ABSENT}/collaborators` },
    {
      method: 'POST' as const,
      url: `/v1/playlists/${ABSENT}/collaborators`,
      payload: { handle: 'x', role: 'editor' },
    },
    { method: 'DELETE' as const, url: `/v1/playlists/${ABSENT}/collaborators/me` },
    {
      method: 'POST' as const,
      url: `/v1/playlists/${ABSENT}/invites`,
      payload: { role: 'editor', maxUses: null },
    },
    { method: 'GET' as const, url: `/v1/playlists/${ABSENT}/invites` },
    { method: 'POST' as const, url: '/v1/playlist-invites/abc/accept' },
    { method: 'POST' as const, url: '/v1/playlist-invites/abc/decline' },
  ])('refuses an anonymous $method $url with 401', async ({ method, url, payload }) => {
    expect((await ctx.call('anonymous', method, url, payload)).statusCode).toBe(401);
  });

  it('seats one person invited by handle and another by link, each in their role', async () => {
    await seat('editor', EDITOR, 'editor');
    await seat('contributor', CONTRIBUTOR, 'contributor');

    const listed = await ctx.call('editor', 'GET', `/v1/playlists/${playlistId}/collaborators`);

    expect(listed.statusCode).toBe(200);
    expect(
      listed.json().items.map((seat: { userId: string; role: string }) => [seat.userId, seat.role])
    ).toEqual([
      [EDITOR, 'editor'],
      [CONTRIBUTOR, 'contributor'],
    ]);
    expect((await ctx.call('contributor', 'GET', `/v1/playlists/${playlistId}`)).statusCode).toBe(
      200
    );
  });

  it('joins through a link until it is used up, revoked or expired', async () => {
    const once = await link({ role: 'contributor', maxUses: 1 });
    const revoked = await link({ role: 'editor', maxUses: null });
    const invites = (await ctx.call('owner', 'GET', `/v1/playlists/${playlistId}/invites`)).json();
    const revokedId = invites.items.find((item: { token: string }) => item.token === revoked).id;
    await ctx.call('owner', 'DELETE', `/v1/playlists/${playlistId}/invites/${revokedId}`);
    const expired = 'e'.repeat(22);
    expectOk(
      await ctx.repositories.playlistCollaborators.createInvite({
        id: '00000000-0000-7000-8000-00000000e2e1',
        playlistId,
        role: 'editor',
        token: expired,
        inviteeUserId: null,
        createdBy: OWNER,
        expiresAt: new Date(Date.now() - 1000),
        maxUses: null,
        useCount: 0,
        revokedAt: null,
        createdAt: new Date(Date.now() - 2000),
      })
    );

    const joined = await ctx.call('contributor', 'POST', `/v1/playlist-invites/${once}/accept`);
    const refused = await Promise.all(
      [once, revoked, expired].map((token) =>
        ctx.call('stranger', 'POST', `/v1/playlist-invites/${token}/accept`)
      )
    );

    expect(joined.json()).toEqual({ playlistId, role: 'contributor' });
    expect(refused.map((res) => [res.statusCode, res.json().code])).toEqual(
      Array(3).fill([410, ErrorCodes.PLAYLIST_INVITE_INVALID])
    );
  });

  it('lets a contributor add, and remove only their own items', async () => {
    await seat('contributor', CONTRIBUTOR, 'contributor');
    await ctx.call('owner', 'POST', `/v1/playlists/${playlistId}/items`, { videoId: V0 });
    await ctx.call('contributor', 'POST', `/v1/playlists/${playlistId}/items`, { videoId: V1 });

    const others = await ctx.call(
      'contributor',
      'DELETE',
      `/v1/playlists/${playlistId}/items/${V0}`
    );
    const own = await ctx.call('contributor', 'DELETE', `/v1/playlists/${playlistId}/items/${V1}`);

    expect([others.statusCode, others.json().code]).toEqual([403, ErrorCodes.FORBIDDEN]);
    expect(own.statusCode).toBe(204);
    expect(await ctx.order(playlistId)).toEqual([V0]);
  });

  it('credits every item to the person who added it', async () => {
    await seat('editor', EDITOR, 'editor');
    await ctx.call('owner', 'POST', `/v1/playlists/${playlistId}/items`, { videoId: V0 });
    await ctx.call('editor', 'POST', `/v1/playlists/${playlistId}/items`, { videoId: V1 });

    const { items } = (await ctx.call('owner', 'GET', `/v1/playlists/${playlistId}`)).json();

    expect(items.map((item: { addedBy: { userId: string } }) => item.addedBy.userId)).toEqual([
      OWNER,
      EDITOR,
    ]);
  });

  it.each<{
    scenario: string;
    who: Who;
    method: 'PATCH' | 'DELETE' | 'POST';
    path: string;
    payload?: Record<string, unknown>;
    status: number;
  }>([
    {
      scenario: 'an editor renames',
      who: 'editor',
      method: 'PATCH',
      path: '',
      payload: { title: 'Ours' },
      status: 200,
    },
    {
      scenario: 'an editor changes the visibility',
      who: 'editor',
      method: 'PATCH',
      path: '',
      payload: { visibility: 'public' },
      status: 403,
    },
    { scenario: 'an editor deletes', who: 'editor', method: 'DELETE', path: '', status: 403 },
    {
      scenario: 'an editor invites',
      who: 'editor',
      method: 'POST',
      path: '/invites',
      payload: { role: 'editor', maxUses: null },
      status: 403,
    },
    {
      scenario: 'a contributor renames',
      who: 'contributor',
      method: 'PATCH',
      path: '',
      payload: { title: 'Mine' },
      status: 403,
    },
    {
      scenario: 'a contributor reorders',
      who: 'contributor',
      method: 'POST',
      path: '/sort',
      payload: { sort: 'added' },
      status: 403,
    },
    {
      scenario: 'a stranger sorts the private list',
      who: 'stranger',
      method: 'POST',
      path: '/sort',
      payload: { sort: 'added' },
      status: 404,
    },
  ])('answers $status when $scenario', async ({ who, method, path, payload, status }) => {
    await seat('editor', EDITOR, 'editor');
    await seat('contributor', CONTRIBUTOR, 'contributor');

    const res = await ctx.call(who, method, `/v1/playlists/${playlistId}${path}`, payload);

    expect(res.statusCode).toBe(status);
  });

  it('lets a collaborator leave, and refuses the owner', async () => {
    await seat('editor', EDITOR, 'editor');

    const left = await ctx.call('editor', 'DELETE', `/v1/playlists/${playlistId}/collaborators/me`);
    const owner = await ctx.call('owner', 'DELETE', `/v1/playlists/${playlistId}/collaborators/me`);

    expect(left.statusCode).toBe(204);
    expect((await ctx.call('editor', 'GET', `/v1/playlists/${playlistId}`)).statusCode).toBe(404);
    expect(owner.json().code).toBe(ErrorCodes.PLAYLIST_COLLABORATOR_NOT_FOUND);
  });

  it('changes a role and takes a seat away', async () => {
    await seat('editor', EDITOR, 'editor');
    const base = `/v1/playlists/${playlistId}/collaborators/${EDITOR}`;

    const changed = await ctx.call('owner', 'PATCH', base, { role: 'contributor' });
    const renamed = await ctx.call('editor', 'PATCH', `/v1/playlists/${playlistId}`, {
      title: 'x',
    });
    const removed = await ctx.call('owner', 'DELETE', base);
    const again = await ctx.call('owner', 'DELETE', base);

    expect([changed.statusCode, renamed.statusCode, removed.statusCode]).toEqual([204, 403, 204]);
    expect(again.json().code).toBe(ErrorCodes.PLAYLIST_COLLABORATOR_NOT_FOUND);
  });

  it('lets the invitee decline, after which the invite is gone', async () => {
    const { token } = (await invite(EDITOR, 'editor')).json();

    const declined = await ctx.call('editor', 'POST', `/v1/playlist-invites/${token}/decline`);
    const accepted = await ctx.call('editor', 'POST', `/v1/playlist-invites/${token}/accept`);

    expect(declined.statusCode).toBe(204);
    expect(accepted.statusCode).toBe(410);
  });

  it.each([
    {
      scenario: 'an unknown handle',
      handle: 'nobody-here',
      code: ErrorCodes.CHANNEL_NOT_FOUND,
      status: 404,
    },
    {
      scenario: 'the owner themself',
      handle: null,
      code: ErrorCodes.PLAYLIST_COLLABORATOR_EXISTS,
      status: 409,
    },
  ])('refuses to invite $scenario', async ({ handle, code, status }) => {
    const res = await ctx.call('owner', 'POST', `/v1/playlists/${playlistId}/collaborators`, {
      handle: handle ?? (await handleOf(OWNER)),
      role: 'editor',
    });

    expect([res.statusCode, res.json().code]).toEqual([status, code]);
  });
});
