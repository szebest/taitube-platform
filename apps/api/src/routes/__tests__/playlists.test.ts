import { ErrorCodes } from '@vp/errors';
import { expectOk } from '@vp/testing/result';
import {
  ABSENT,
  type LibraryApp,
  PRIVATE_VIDEO,
  VIDEOS,
  buildLibraryApp,
} from '../../__tests__/library-app';

const [V0, V1, V2, V3, V4] = VIDEOS;

describe('playlist routes', () => {
  let ctx: LibraryApp;

  beforeEach(async () => {
    ctx = await buildLibraryApp();
  });

  afterEach(async () => {
    await ctx.app.close();
  });

  async function withFive(): Promise<string> {
    const id = await ctx.playlist('owner');
    for (const videoId of VIDEOS) {
      expect(
        (await ctx.call('owner', 'POST', `/v1/playlists/${id}/items`, { videoId })).statusCode
      ).toBe(201);
    }
    return id;
  }

  it.each([
    { method: 'POST' as const, url: '/v1/playlists', payload: { title: 'x' } },
    { method: 'PATCH' as const, url: `/v1/playlists/${ABSENT}`, payload: { title: 'x' } },
    { method: 'DELETE' as const, url: `/v1/playlists/${ABSENT}` },
    { method: 'POST' as const, url: `/v1/playlists/${ABSENT}/items`, payload: { videoId: ABSENT } },
    { method: 'DELETE' as const, url: `/v1/playlists/${ABSENT}/items/${ABSENT}` },
    { method: 'PUT' as const, url: `/v1/playlists/${ABSENT}/reorder`, payload: { itemIds: [] } },
    { method: 'GET' as const, url: '/v1/me/playlists' },
  ])('refuses an anonymous $method $url with 401', async ({ method, url, payload }) => {
    const res = await ctx.call('anonymous', method, url, payload);

    expect(res.statusCode).toBe(401);
    expect(res.json().code).toBe(ErrorCodes.UNAUTHORIZED);
  });

  it('creates a private playlist by default and reads it back empty', async () => {
    const res = await ctx.call('owner', 'POST', '/v1/playlists', { title: '  Road trip ' });

    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({
      title: 'Road trip',
      description: '',
      visibility: 'private',
      isSystem: false,
      videoCount: 0,
      items: [],
      thumbnailUrl: null,
    });
  });

  it.each([
    { scenario: 'a blank title', payload: { title: '   ' }, status: 422 },
    {
      scenario: 'an unknown visibility',
      payload: { title: 'Mix', visibility: 'friends' },
      status: 400,
    },
  ])('refuses $scenario with $status', async ({ payload, status }) => {
    const res = await ctx.call('owner', 'POST', '/v1/playlists', payload);

    expect(res.statusCode).toBe(status);
    expect(res.json().code).toBe(ErrorCodes.VALIDATION_FAILED);
  });

  it('appends videos in order with their channel and the first poster as thumbnail', async () => {
    const id = await withFive();

    const res = await ctx.call('anonymous', 'GET', `/v1/playlists/${id}`);

    expect(res.statusCode).toBe(404);
    const owned = (await ctx.call('owner', 'GET', `/v1/playlists/${id}`)).json();
    expect(owned.videoCount).toBe(5);
    expect(
      owned.items.map((item: { videoId: string; position: number }) => [
        item.videoId,
        item.position,
      ])
    ).toEqual(VIDEOS.map((videoId, index) => [videoId, index]));
    expect(owned.items[0]).toMatchObject({ video: { id: V0 }, channel: { handle: 'creator' } });
  });

  it('keeps adding a video twice a no-op', async () => {
    const id = await ctx.playlist('owner');
    await ctx.call('owner', 'POST', `/v1/playlists/${id}/items`, { videoId: V0 });

    const again = await ctx.call('owner', 'POST', `/v1/playlists/${id}/items`, { videoId: V0 });

    expect(again.statusCode).toBe(201);
    expect(again.json().videoCount).toBe(1);
  });

  it('refuses to add a video the caller may not watch, as if it did not exist', async () => {
    const id = await ctx.playlist('owner');

    const res = await ctx.call('owner', 'POST', `/v1/playlists/${id}/items`, {
      videoId: PRIVATE_VIDEO,
    });

    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe(ErrorCodes.VIDEO_NOT_FOUND);
  });

  it.each([
    { to: 0, order: [V4, V0, V1, V2, V3] },
    { to: 1, order: [V0, V4, V1, V2, V3] },
    { to: 99, order: [V0, V1, V2, V3, V4] },
  ])('moves the fifth item to place $to', async ({ to, order }) => {
    const id = await withFive();
    const itemId = (await ctx.itemIds(id))[4];

    const res = await ctx.call('owner', 'PUT', `/v1/playlists/${id}/reorder`, {
      itemId,
      newPosition: to,
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().items.map((item: { videoId: string }) => item.videoId)).toEqual(order);
  });

  it('puts every item in the order a full reindex gives', async () => {
    const id = await withFive();
    const itemIds = (await ctx.itemIds(id)).reverse();

    const res = await ctx.call('owner', 'PUT', `/v1/playlists/${id}/reorder`, { itemIds });

    expect(res.statusCode).toBe(200);
    expect(await ctx.order(id)).toEqual([...VIDEOS].reverse());
  });

  it.each([
    {
      scenario: 'a full order drawn before an item was added',
      stale: true,
      status: 409,
      code: ErrorCodes.VERSION_CONFLICT,
    },
    {
      scenario: 'a move of an item the playlist does not hold',
      stale: false,
      status: 404,
      code: ErrorCodes.PLAYLIST_ITEM_NOT_FOUND,
    },
  ])('refuses $scenario with $code', async ({ stale, status, code }) => {
    const id = await withFive();
    const itemIds = await ctx.itemIds(id);
    const body = stale ? { itemIds: itemIds.slice(1) } : { itemId: ABSENT, newPosition: 0 };

    const res = await ctx.call('owner', 'PUT', `/v1/playlists/${id}/reorder`, body);

    expect(res.statusCode).toBe(status);
    expect(res.json().code).toBe(code);
    expect(await ctx.order(id)).toEqual(VIDEOS);
  });

  it('reorders around a video its creator made private, which keeps its slot', async () => {
    const id = await ctx.playlist('owner');
    for (const videoId of [V0, V1, V2]) {
      await ctx.call('owner', 'POST', `/v1/playlists/${id}/items`, { videoId });
    }
    const hidden = expectOk(await ctx.repositories.videos.findById(V1));
    if (hidden) hidden.visibility = 'private';
    const visible = (await ctx.call('owner', 'GET', `/v1/playlists/${id}`)).json().items;

    const res = await ctx.call('owner', 'PUT', `/v1/playlists/${id}/reorder`, {
      itemIds: visible.map((item: { id: string }) => item.id).reverse(),
    });

    expect(res.statusCode).toBe(200);
    expect(
      res
        .json()
        .items.map((item: { videoId: string; position: number }) => [item.videoId, item.position])
    ).toEqual([
      [V2, 0],
      [V0, 2],
    ]);
  });

  it('removes a video and moves the rest up one place', async () => {
    const id = await withFive();

    const res = await ctx.call('owner', 'DELETE', `/v1/playlists/${id}/items/${V1}`);

    expect(res.statusCode).toBe(204);
    const items = (await ctx.call('owner', 'GET', `/v1/playlists/${id}`)).json().items;
    expect(
      items.map((item: { videoId: string; position: number }) => [item.videoId, item.position])
    ).toEqual([
      [V0, 0],
      [V2, 1],
      [V3, 2],
      [V4, 3],
    ]);
  });

  it('edits the details and deletes the playlist', async () => {
    const id = await ctx.playlist('owner');

    const edited = await ctx.call('owner', 'PATCH', `/v1/playlists/${id}`, {
      title: 'Renamed',
      visibility: 'unlisted',
    });
    const removed = await ctx.call('owner', 'DELETE', `/v1/playlists/${id}`);

    expect(edited.json()).toMatchObject({ title: 'Renamed', visibility: 'unlisted' });
    expect(removed.statusCode).toBe(204);
    expect((await ctx.call('owner', 'GET', `/v1/playlists/${id}`)).statusCode).toBe(404);
  });

  it('lists my playlists with Watch Later first and whether each holds the video', async () => {
    const id = await ctx.playlist('owner');
    await ctx.call('owner', 'POST', `/v1/playlists/${id}/items`, { videoId: V2 });

    const res = await ctx.call('owner', 'GET', `/v1/me/playlists?videoId=${V2}`);

    expect(res.statusCode).toBe(200);
    expect(res.json().items).toMatchObject([
      {
        title: 'Watch Later',
        isSystem: true,
        visibility: 'private',
        containsVideo: false,
        videoCount: 0,
      },
      { id, title: 'Mix', isSystem: false, containsVideo: true, videoCount: 1 },
    ]);
  });
});
