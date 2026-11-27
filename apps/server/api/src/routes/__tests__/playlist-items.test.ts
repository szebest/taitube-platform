import { ErrorCodes } from '@vp/errors';
import {
  CONTRIBUTOR,
  EDITOR,
  type LibraryApp,
  VIDEOS,
  type Who,
  buildLibraryApp,
} from '../../__tests__/library-app';
import { seedPrimaryChannel, seedVideo } from '../../__tests__/test-app';

const [V0, V1, V2] = VIDEOS;
const TIMED = '66666666-6666-7666-8666-6666666666b1';

describe('playlist item routes', () => {
  let ctx: LibraryApp;
  let playlistId: string;
  let base: string;

  const seat = async (who: Who, userId: string, role: 'editor' | 'contributor') => {
    await seedPrimaryChannel(ctx.repositories, userId);
    const channel = await ctx.repositories.channels.findPrimaryByUserId(userId);
    const handle = channel.ok ? channel.value?.handle : '';
    const { token } = (
      await ctx.call('owner', 'POST', `${base}/collaborators`, { handle, role })
    ).json();
    await ctx.call(who, 'POST', `/v1/playlist-invites/${token}/accept`);
  };

  const add = (who: Who, videoId: string) => ctx.call(who, 'POST', `${base}/items`, { videoId });

  const itemOf = async (videoId: string) => {
    const { items } = (await ctx.call('owner', 'GET', base)).json();
    return items.find((item: { videoId: string }) => item.videoId === videoId);
  };

  const activity = async (who: Who = 'owner') =>
    (await ctx.call(who, 'GET', `${base}/activity`)).json().items as {
      id: string;
      action: string;
    }[];

  beforeEach(async () => {
    ctx = await buildLibraryApp();
    playlistId = await ctx.playlist('owner');
    base = `/v1/playlists/${playlistId}`;
    await seedVideo(ctx.repositories, {
      id: TIMED,
      ownerId: CONTRIBUTOR,
      title: 'Lecture',
      durationMs: 60_000,
    });
  });

  afterEach(async () => {
    await ctx.app.close();
  });

  it('keeps a note and a segment on an item, and refuses a segment past the video', async () => {
    await add('owner', TIMED);
    const { id } = await itemOf(TIMED);

    const saved = await ctx.call('owner', 'PATCH', `${base}/items/${id}/annotation`, {
      note: ' From the proof ',
      startMs: 10_000,
      endMs: 20_000,
    });
    const past = await ctx.call('owner', 'PATCH', `${base}/items/${id}/annotation`, {
      endMs: 90_000,
    });
    const short = await ctx.call('owner', 'PATCH', `${base}/items/${id}/annotation`, {
      endMs: 10_500,
    });

    expect(saved.statusCode).toBe(204);
    expect(await itemOf(TIMED)).toMatchObject({
      note: 'From the proof',
      startMs: 10_000,
      endMs: 20_000,
    });
    expect([past.statusCode, short.statusCode]).toEqual([422, 422]);
  });

  it('adds a section that holds no video, is never counted and can be removed', async () => {
    await add('owner', V0);

    const added = await ctx.call('owner', 'POST', `${base}/sections`, { title: ' Part two ' });
    const { id } = added.json();
    const withSection = (await ctx.call('owner', 'GET', base)).json();
    const removed = await ctx.call('owner', 'DELETE', `${base}/sections/${id}`);
    const notSection = await ctx.call(
      'owner',
      'DELETE',
      `${base}/sections/${(await itemOf(V0)).id}`
    );

    expect(added.statusCode).toBe(201);
    expect(withSection).toMatchObject({
      videoCount: 1,
      sections: [{ id, title: 'Part two', position: 1 }],
    });
    expect(removed.statusCode).toBe(204);
    expect(notSection.json().code).toBe(ErrorCodes.PLAYLIST_ITEM_NOT_FOUND);
  });

  it('lets a contributor annotate only what they added', async () => {
    await seat('contributor', CONTRIBUTOR, 'contributor');
    await add('owner', V0);
    await add('contributor', V1);

    const others = await ctx.call(
      'contributor',
      'PATCH',
      `${base}/items/${(await itemOf(V0)).id}/annotation`,
      {
        note: 'mine now',
      }
    );
    const own = await ctx.call(
      'contributor',
      'PATCH',
      `${base}/items/${(await itemOf(V1)).id}/annotation`,
      {
        note: 'my pick',
      }
    );

    expect([others.statusCode, own.statusCode]).toEqual([403, 204]);
  });

  it('pages the items in the order asked for, and an editor writes it back', async () => {
    await seat('editor', EDITOR, 'editor');
    for (const videoId of [V0, V1, V2]) await add('owner', videoId);

    const first = (await ctx.call('anonymous', 'GET', `${base}/items?sort=added&limit=2`)).json();
    const own = (await ctx.call('owner', 'GET', `${base}/items?sort=added&limit=2`)).json();
    const next = await ctx.call(
      'owner',
      'GET',
      `${base}/items?sort=added&limit=2&cursor=${own.nextCursor}`
    );
    const wrongSort = await ctx.call(
      'owner',
      'GET',
      `${base}/items?sort=manual&cursor=${own.nextCursor}`
    );
    const sorted = await ctx.call('editor', 'POST', `${base}/sort`, { sort: 'added' });

    expect(first.code).toBe(ErrorCodes.PLAYLIST_NOT_FOUND);
    expect(own.items.map((item: { videoId: string }) => item.videoId)).toEqual([V2, V1]);
    expect(next.json().items.map((item: { videoId: string }) => item.videoId)).toEqual([V0]);
    expect(wrongSort.json().code).toBe(ErrorCodes.INVALID_CURSOR);
    expect(sorted.statusCode).toBe(204);
    expect(await ctx.order(playlistId)).toEqual([V2, V1, V0]);
  });

  it('logs each change once for the people on the list, folding a run of reorders', async () => {
    await seat('editor', EDITOR, 'editor');
    await add('owner', V0);
    await add('editor', V1);
    await ctx.call('owner', 'POST', `${base}/sort`, { sort: 'added' });
    await ctx.call('owner', 'POST', `${base}/sort`, { sort: 'duration' });

    const actions = (await activity('editor')).map((entry) => entry.action);
    const stranger = await ctx.call('stranger', 'GET', `${base}/activity`);

    expect(actions).toEqual(['items_reordered', 'item_added', 'item_added', 'collaborator_added']);
    expect(stranger.statusCode).toBe(404);
  });

  it('lets the owner restore a removed item from the log, once', async () => {
    await seat('editor', EDITOR, 'editor');
    await add('editor', V0);
    await ctx.call('editor', 'PATCH', `${base}/items/${(await itemOf(V0)).id}/annotation`, {
      note: 'keep',
    });
    await ctx.call('editor', 'DELETE', `${base}/items/${V0}`);
    const removal = (await activity()).find((entry) => entry.action === 'item_removed');
    const restore = (who: Who) => ctx.call(who, 'POST', `${base}/activity/${removal?.id}/restore`);

    const byEditor = await restore('editor');
    const byOwner = await restore('owner');
    const again = await restore('owner');

    expect(byEditor.statusCode).toBe(403);
    expect(byOwner.statusCode).toBe(204);
    expect(await itemOf(V0)).toMatchObject({ note: 'keep', addedBy: { userId: EDITOR } });
    expect(again.json().code).toBe(ErrorCodes.PLAYLIST_ACTIVITY_NOT_RESTORABLE);
  });
});
