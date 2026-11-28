import { expectOk } from '@kit/testing/result';
import { Adapters } from '@vp/adapters/composition';
import { ErrorCodes } from '@vp/errors';
import {
  EDITOR,
  type LibraryApp,
  VIDEOS,
  type Who,
  buildLibraryApp,
} from '../../__tests__/library-app';
import { seedPrimaryChannel } from '../../__tests__/test-app';

const [V0, V1] = VIDEOS;
const SESSION = { 'x-viewer-session': '00000000-0000-4000-8000-0000000000aa' };

describe('playlist sharing routes', () => {
  let ctx: LibraryApp;
  let playlistId: string;
  let base: string;

  const share = async (expiresIn = '24h') =>
    (await ctx.call('owner', 'POST', `${base}/share-links`, { expiresIn })).json();
  const read = (token: string, who: Who = 'anonymous') =>
    ctx.call(who, 'GET', `${base}?s=${token}`);
  const flush = async () => {
    const buffer = ctx.container.get(Adapters.ViewBuffer);
    const batch = expectOk(await buffer.snapshot(crypto.randomUUID()));
    if (!batch) return;
    expectOk(await ctx.repositories.videoViews.applyBatch(batch));
    expectOk(await buffer.release(batch.batchId));
  };

  beforeEach(async () => {
    ctx = await buildLibraryApp();
    playlistId = await ctx.playlist('owner', { title: 'Private' });
    base = `/v1/playlists/${playlistId}`;
    await ctx.call('owner', 'POST', `${base}/items`, { videoId: V0 });
  });

  afterEach(async () => {
    await ctx.app.close();
  });

  it('lets a link read a private playlist until it is revoked, and counts its opens', async () => {
    const link = await share();

    const shared = await read(link.token);
    const without = await ctx.call('anonymous', 'GET', base);
    const elsewhere = await ctx.call(
      'anonymous',
      'GET',
      `/v1/playlists/${await ctx.playlist('owner')}?s=${link.token}`
    );
    await ctx.app.inject({ method: 'GET', url: `${base}?s=${link.token}`, headers: SESSION });
    await flush();
    const listed = (await ctx.call('owner', 'GET', `${base}/share-links`)).json().items;
    const revoked = await ctx.call('owner', 'DELETE', `${base}/share-links/${link.id}`);
    const after = await read(link.token);

    expect(shared.statusCode).toBe(200);
    expect(shared.json().items.map((item: { videoId: string }) => item.videoId)).toEqual([V0]);
    expect([without.statusCode, elsewhere.statusCode]).toEqual([404, 404]);
    expect(listed).toEqual([
      expect.objectContaining({
        id: link.id,
        state: 'active',
        stats: expect.objectContaining({ opens: 1 }),
      }),
    ]);
    expect(revoked.statusCode).toBe(204);
    expect([after.statusCode, after.json().code]).toEqual([410, ErrorCodes.SHARE_LINK_EXPIRED]);
  });

  it('lets a link page the items of the playlist it opens', async () => {
    const link = await share();

    const page = await ctx.call('anonymous', 'GET', `${base}/items?s=${link.token}`);

    expect(page.statusCode).toBe(200);
    expect(page.json().items).toHaveLength(1);
  });

  it.each([
    { who: 'stranger' as const, status: 404 },
    { who: 'anonymous' as const, status: 401 },
  ])('keeps the links of a private playlist from $who: $status', async ({ who, status }) => {
    expect(
      (await ctx.call(who, 'POST', `${base}/share-links`, { expiresIn: '1h' })).statusCode
    ).toBe(status);
  });

  it('keeps the links and the stats from an editor, and Watch Later unshared', async () => {
    await seedPrimaryChannel(ctx.repositories, EDITOR);
    const handle = expectOk(await ctx.repositories.channels.findPrimaryByUserId(EDITOR))?.handle;
    const { token } = (
      await ctx.call('owner', 'POST', `${base}/collaborators`, { handle, role: 'editor' })
    ).json();
    await ctx.call('editor', 'POST', `/v1/playlist-invites/${token}/accept`);
    const watchLater = (await ctx.call('owner', 'GET', '/v1/me/playlists')).json().items[0].id;

    const statuses = [
      (await ctx.call('editor', 'POST', `${base}/share-links`, { expiresIn: '1h' })).statusCode,
      (await ctx.call('editor', 'GET', `/v1/me/playlists/${playlistId}/stats`)).statusCode,
      (
        await ctx.call('owner', 'POST', `/v1/playlists/${watchLater}/share-links`, {
          expiresIn: '1h',
        })
      ).statusCode,
    ];

    expect(statuses).toEqual([403, 403, 400]);
  });

  it('shows the owner opens once a viewer a day, plays, follows, forks and the top items, and nobody else', async () => {
    await ctx.call('owner', 'PATCH', base, { visibility: 'public' });
    await ctx.call('owner', 'POST', `${base}/items`, { videoId: V1 });
    await ctx.app.inject({ method: 'GET', url: base, headers: SESSION });
    await ctx.call('stranger', 'GET', base);
    await ctx.call('stranger', 'GET', base);
    await ctx.call('owner', 'GET', base);
    await ctx.call('anonymous', 'GET', base);
    await ctx.call('stranger', 'PUT', `${base}/follow`);
    await ctx.call('stranger', 'POST', `${base}/fork`);
    for (const videoId of [V1, V1, V0]) {
      await ctx.app.inject({
        method: 'POST',
        url: '/v1/telemetry/playback',
        payload: {
          videoId,
          sessionUuid: crypto.randomUUID(),
          eventType: 'playback_start',
          currentTime: 0,
          duration: 60,
          playlistId,
        },
      });
    }
    await flush();

    const stats = await ctx.call('owner', 'GET', `/v1/me/playlists/${playlistId}/stats?range=7d`);
    const stranger = await ctx.call('stranger', 'GET', `/v1/me/playlists/${playlistId}/stats`);

    expect(stats.statusCode).toBe(200);
    expect(stats.json()).toMatchObject({ opens: 2, plays: 3, follows: 1, forks: 1 });
    expect(
      stats
        .json()
        .topItems.map((item: { videoId: string; plays: number }) => [item.videoId, item.plays])
    ).toEqual([
      [V1, 2],
      [V0, 1],
    ]);
    expect([stranger.statusCode, stranger.json().code]).toEqual([403, ErrorCodes.FORBIDDEN]);
  });
});
