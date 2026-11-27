import { ErrorCodes } from '@vp/errors';
import {
  type LibraryApp,
  OWNER,
  STRANGER,
  VIDEOS,
  type Who,
  buildLibraryApp,
} from '../../__tests__/library-app';

const [V0, V1, V2] = VIDEOS;
const UNWATCHED = { match: 'all', conditions: [{ field: 'unwatched' }], sort: 'oldest', limit: 3 };

describe('playlist library routes', () => {
  let ctx: LibraryApp;

  const watch = (userId: string, videoId: string) =>
    ctx.repositories.watchHistory.record({
      id: crypto.randomUUID(),
      userId,
      videoId,
      progressSeconds: 100,
      durationSeconds: 100,
      watchedAt: new Date(),
    });
  const videosOf = async (who: Who, playlistId: string) =>
    (await ctx.call(who, 'GET', `/v1/playlists/${playlistId}`))
      .json()
      .items.map((item: { videoId: string }) => item.videoId);

  beforeEach(async () => {
    ctx = await buildLibraryApp();
  });

  afterEach(async () => {
    await ctx.app.close();
  });

  it('computes a smart playlist for each viewer, refuses a manual add, and freezes what it computes', async () => {
    const smart = await ctx.playlist('owner', {
      title: 'Not yet seen',
      visibility: 'public',
      rules: UNWATCHED,
    });
    await watch(OWNER, V0);
    await watch(STRANGER, V1);

    const added = await ctx.call('owner', 'POST', `/v1/playlists/${smart}/items`, { videoId: V2 });
    const frozen = await ctx.call('stranger', 'POST', `/v1/playlists/${smart}/freeze`);

    expect([await videosOf('owner', smart), await videosOf('stranger', smart)]).toEqual([
      [V1, V2, VIDEOS[3]],
      [V0, V2, VIDEOS[3]],
    ]);
    expect([added.statusCode, added.json().code]).toEqual([409, ErrorCodes.PLAYLIST_IS_SMART]);
    expect(frozen.statusCode).toBe(201);
    expect(frozen.json()).toMatchObject({ ownerId: STRANGER, visibility: 'private', rules: null });
    expect(await videosOf('stranger', frozen.json().id)).toEqual([V0, V2, VIDEOS[3]]);
    expect(await videosOf('owner', smart)).toEqual([V1, V2, VIDEOS[3]]);
  });

  it('pages a smart playlist on its own sort, whatever the sort asked', async () => {
    const smart = await ctx.playlist('owner', {
      title: 'All',
      rules: { ...UNWATCHED, conditions: [] },
    });

    const first = (
      await ctx.call('owner', 'GET', `/v1/playlists/${smart}/items?limit=2&sort=duration`)
    ).json();
    const second = (
      await ctx.call(
        'owner',
        'GET',
        `/v1/playlists/${smart}/items?limit=2&cursor=${first.nextCursor}`
      )
    ).json();

    expect(
      [...first.items, ...second.items].map((item: { videoId: string }) => item.videoId)
    ).toEqual([V0, V1, V2]);
    expect(second.nextCursor).toBeNull();
  });

  it.each([
    { who: 'owner' as const, status: 409, code: ErrorCodes.PLAYLIST_NOT_SMART },
    { who: 'anonymous' as const, status: 401, code: ErrorCodes.UNAUTHORIZED },
  ])('refuses $who freezing a plain playlist with $status', async ({ who, status, code }) => {
    const plain = await ctx.playlist('owner', { title: 'Plain', visibility: 'public' });

    const res = await ctx.call(who, 'POST', `/v1/playlists/${plain}/freeze`);

    expect([res.statusCode, res.json().code]).toEqual([status, code]);
  });

  it('pins five playlists at most, for their owner alone', async () => {
    const ids = [];
    for (let n = 0; n < 6; n += 1) ids.push(await ctx.playlist('owner', { title: `List ${n}` }));
    const pin = (who: Who, id: string) => ctx.call(who, 'PUT', `/v1/playlists/${id}/pin`);

    const pinned = [];
    for (const id of ids.slice(0, 5)) pinned.push((await pin('owner', id)).statusCode);
    const sixth = await pin('owner', ids[5] ?? '');
    const again = await pin('owner', ids[0] ?? '');
    const stranger = await pin('stranger', ids[0] ?? '');
    const mine = (await ctx.call('owner', 'GET', '/v1/me/playlists')).json().items;

    expect(pinned).toEqual([204, 204, 204, 204, 204]);
    expect([sixth.statusCode, sixth.json().code]).toEqual([409, ErrorCodes.PLAYLIST_PIN_LIMIT]);
    expect([again.statusCode, stranger.statusCode]).toEqual([204, 404]);
    expect(mine.filter((row: { pinnedAt: string | null }) => row.pinnedAt !== null)).toHaveLength(
      5
    );
    expect((await ctx.call('owner', 'DELETE', `/v1/playlists/${ids[0]}/pin`)).statusCode).toBe(204);
  });

  it('follows a playlist live and shows it as gone once it turns private', async () => {
    const id = await ctx.playlist('owner', { title: 'Shared', visibility: 'public' });
    const following = async () =>
      (await ctx.call('stranger', 'GET', '/v1/me/playlists/following')).json().items;

    const own = await ctx.call('owner', 'PUT', `/v1/playlists/${id}/follow`);
    expect((await ctx.call('stranger', 'PUT', `/v1/playlists/${id}/follow`)).statusCode).toBe(204);
    await ctx.call('owner', 'PATCH', `/v1/playlists/${id}`, { title: 'Renamed' });

    expect(own.statusCode).toBe(403);
    expect(await following()).toEqual([
      expect.objectContaining({
        playlistId: id,
        playlist: expect.objectContaining({ title: 'Renamed' }),
      }),
    ]);

    await ctx.call('owner', 'PATCH', `/v1/playlists/${id}`, { visibility: 'private' });

    expect(await following()).toEqual([
      expect.objectContaining({ playlistId: id, playlist: null }),
    ]);
    expect((await ctx.call('stranger', 'DELETE', `/v1/playlists/${id}/follow`)).statusCode).toBe(
      204
    );
    expect(await following()).toEqual([]);
  });

  it('forks a playlist into an independent private copy that credits its source', async () => {
    const id = await ctx.playlist('owner', { title: 'Source', visibility: 'public' });
    await ctx.call('owner', 'POST', `/v1/playlists/${id}/items`, { videoId: V0 });

    const fork = await ctx.call('stranger', 'POST', `/v1/playlists/${id}/fork`);
    const forkId = fork.json().id;
    await ctx.call('owner', 'POST', `/v1/playlists/${id}/items`, { videoId: V1 });
    await ctx.call('stranger', 'POST', `/v1/playlists/${forkId}/items`, { videoId: V2 });

    expect(fork.statusCode).toBe(201);
    expect(fork.json()).toMatchObject({
      ownerId: STRANGER,
      visibility: 'private',
      forkedFromPlaylistId: id,
    });
    expect([await videosOf('owner', id), await videosOf('stranger', forkId)]).toEqual([
      [V0, V1],
      [V0, V2],
    ]);
  });

  it('answers a private playlist of someone else as not found to follow or fork', async () => {
    const id = await ctx.playlist('owner', { title: 'Mine' });

    const statuses = [
      (await ctx.call('stranger', 'PUT', `/v1/playlists/${id}/follow`)).statusCode,
      (await ctx.call('stranger', 'POST', `/v1/playlists/${id}/fork`)).statusCode,
    ];

    expect(statuses).toEqual([404, 404]);
  });
});
