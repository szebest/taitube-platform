import { ErrorCodes } from '@vp/errors';
import { type LibraryApp, VIDEOS, type Who, buildLibraryApp } from './library-app';

const PRIVATE_READ = { owner: 200, admin: 200, stranger: 404, anonymous: 404 };
const OPEN_READ = { owner: 200, admin: 200, stranger: 200, anonymous: 200 };

describe('playlists: privacy and ownership over HTTP', () => {
  let ctx: LibraryApp;

  beforeEach(async () => {
    ctx = await buildLibraryApp();
  });

  afterEach(async () => {
    await ctx.app.close();
  });

  it.each([
    { visibility: 'private', expected: PRIVATE_READ },
    { visibility: 'unlisted', expected: OPEN_READ },
    { visibility: 'public', expected: OPEN_READ },
  ])('lets the right callers read a $visibility playlist', async ({ visibility, expected }) => {
    const id = await ctx.playlist('owner', { title: 'Mix', visibility });

    const statuses: Record<string, number> = {};
    for (const who of Object.keys(expected) as Who[]) {
      statuses[who] = (await ctx.call(who, 'GET', `/v1/playlists/${id}`)).statusCode;
    }

    expect(statuses).toEqual(expected);
  });

  it('answers a stranger reading a private playlist with PLAYLIST_NOT_FOUND', async () => {
    const id = await ctx.playlist('owner');

    const res = await ctx.call('stranger', 'GET', `/v1/playlists/${id}`);

    expect(res.json().code).toBe(ErrorCodes.PLAYLIST_NOT_FOUND);
  });

  it.each([
    { visibility: 'private', status: 404, code: ErrorCodes.PLAYLIST_NOT_FOUND },
    { visibility: 'public', status: 403, code: ErrorCodes.FORBIDDEN },
  ])(
    'refuses a stranger editing, curating or deleting a $visibility playlist with $code',
    async ({ visibility, status, code }) => {
      const id = await ctx.playlist('owner', { title: 'Mix', visibility });

      const attempts = await Promise.all([
        ctx.call('stranger', 'PATCH', `/v1/playlists/${id}`, { title: 'Mine now' }),
        ctx.call('stranger', 'POST', `/v1/playlists/${id}/items`, { videoId: VIDEOS[0] }),
        ctx.call('stranger', 'DELETE', `/v1/playlists/${id}`),
      ]);

      expect(attempts.map((res) => [res.statusCode, res.json().code])).toEqual([
        [status, code],
        [status, code],
        [status, code],
      ]);
    }
  );

  it("lets an admin curate and delete another user's playlist", async () => {
    const id = await ctx.playlist('owner');

    const added = await ctx.call('admin', 'POST', `/v1/playlists/${id}/items`, {
      videoId: VIDEOS[0],
    });
    const removed = await ctx.call('admin', 'DELETE', `/v1/playlists/${id}`);

    expect([added.statusCode, removed.statusCode]).toEqual([201, 204]);
  });

  it('provisions Watch Later on first sign-in and never lets it be renamed or deleted', async () => {
    const [watchLater] = (await ctx.call('owner', 'GET', '/v1/me/playlists')).json().items;

    const renamed = await ctx.call('owner', 'PATCH', `/v1/playlists/${watchLater.id}`, {
      title: 'Later',
    });
    const deleted = await ctx.call('owner', 'DELETE', `/v1/playlists/${watchLater.id}`);
    const saved = await ctx.call('owner', 'POST', `/v1/playlists/${watchLater.id}/items`, {
      videoId: VIDEOS[0],
    });

    expect(watchLater).toMatchObject({
      title: 'Watch Later',
      isSystem: true,
      visibility: 'private',
    });
    expect([renamed.statusCode, renamed.json().code]).toEqual([
      400,
      ErrorCodes.SYSTEM_PLAYLIST_IMMUTABLE,
    ]);
    expect([deleted.statusCode, deleted.json().code]).toEqual([
      400,
      ErrorCodes.SYSTEM_PLAYLIST_IMMUTABLE,
    ]);
    expect(saved.statusCode).toBe(201);
  });

  it("keeps a stranger's own listing free of my playlists", async () => {
    await ctx.playlist('owner', { title: 'Mine', visibility: 'public' });

    const listed = (await ctx.call('stranger', 'GET', '/v1/me/playlists')).json().items;

    expect(listed.map((row: { title: string }) => row.title)).toEqual(['Watch Later']);
  });
});
