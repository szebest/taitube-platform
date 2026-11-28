import { ErrorCodes } from '@vp/errors';
import {
  CONTRIBUTOR,
  type LibraryApp,
  PRIVATE_VIDEO,
  VIDEOS,
  type Who,
  buildLibraryApp,
} from '../../__tests__/library-app';
import { seedPrimaryChannel } from '../../__tests__/test-app';

const [V0, V1, V2] = VIDEOS;
const FOREIGN = `https://elsewhere.test/watch/${V0}`;

describe('playlist transfer, merge, import and export routes', () => {
  let ctx: LibraryApp;
  let source: string;
  let target: string;

  const fill = async (playlistId: string, videoIds: readonly string[], who: Who = 'owner') => {
    for (const videoId of videoIds) {
      await ctx.call(who, 'POST', `/v1/playlists/${playlistId}/items`, { videoId });
    }
  };

  const itemIdsOf = async (playlistId: string) => ctx.itemIds(playlistId);

  beforeEach(async () => {
    ctx = await buildLibraryApp();
    source = await ctx.playlist('owner', { title: 'From' });
    target = await ctx.playlist('owner', { title: 'To' });
  });

  afterEach(async () => {
    await ctx.app.close();
  });

  it.each(['move', 'copy'] as const)(
    '%ss items, skipping a video the target holds and reporting each',
    async (mode) => {
      await fill(source, [V0, V1]);
      await fill(target, [V1]);
      const [first, second] = await itemIdsOf(source);
      const absent = '99999999-9999-7999-8999-999999999990';

      const res = await ctx.call('owner', 'POST', `/v1/playlists/${source}/items/transfer`, {
        itemIds: [first, second, absent],
        to: target,
        mode,
      });

      expect(res.json()).toEqual({
        playlistId: target,
        results: [
          { itemId: first, ok: true, duplicate: false },
          { itemId: second, ok: true, duplicate: true },
          { itemId: absent, ok: false, duplicate: false, code: ErrorCodes.PLAYLIST_ITEM_NOT_FOUND },
        ],
      });
      expect(await ctx.order(target)).toEqual([V1, V0]);
      expect(await ctx.order(source)).toEqual(mode === 'move' ? [] : [V0, V1]);
    }
  );

  it("refuses to move a contributor's way an item someone else added, one item at a time", async () => {
    const channel = await seedPrimaryChannel(ctx.repositories, CONTRIBUTOR);
    const found = await ctx.repositories.channels.findById(channel);
    const handle = found.ok ? found.value?.handle : '';
    const { token } = (
      await ctx.call('owner', 'POST', `/v1/playlists/${source}/collaborators`, {
        handle,
        role: 'contributor',
      })
    ).json();
    await ctx.call('contributor', 'POST', `/v1/playlist-invites/${token}/accept`);
    await fill(source, [V0]);
    await fill(source, [V1], 'contributor');
    const own = await ctx.playlist('contributor');
    const [others, mine] = await itemIdsOf(source);

    const res = await ctx.call('contributor', 'POST', `/v1/playlists/${source}/items/transfer`, {
      itemIds: [others, mine],
      to: own,
      mode: 'move',
    });

    expect(res.json().results).toEqual([
      { itemId: others, ok: false, duplicate: false, code: ErrorCodes.FORBIDDEN },
      { itemId: mine, ok: true, duplicate: false },
    ]);
  });

  it('duplicates a playlist the caller can read into a private one of theirs', async () => {
    await ctx.call('owner', 'PATCH', `/v1/playlists/${source}`, { visibility: 'public' });
    await fill(source, [V0, V1]);

    const res = await ctx.call('stranger', 'POST', `/v1/playlists/${source}/duplicate`, {});
    const copy = (
      await ctx.call('stranger', 'GET', `/v1/playlists/${res.json().playlistId}`)
    ).json();

    expect(res.statusCode).toBe(201);
    expect(copy).toMatchObject({ title: 'From', visibility: 'private', videoCount: 2 });
  });

  it('merges sources into a new playlist, skipping duplicates, and deletes the sources asked to', async () => {
    await fill(source, [V0, V1]);
    await fill(target, [V1, V2]);

    const res = await ctx.call('owner', 'POST', '/v1/playlists/merge', {
      sourceIds: [source, target],
      newTitle: 'Both',
      deleteSources: true,
    });
    const merged = res.json().playlistId;

    expect(res.json().results.map((row: { duplicate: boolean }) => row.duplicate)).toEqual([
      false,
      false,
      true,
      false,
    ]);
    expect(await ctx.order(merged)).toEqual([V0, V1, V2]);
    expect((await ctx.call('owner', 'GET', `/v1/playlists/${source}`)).statusCode).toBe(404);
  });

  it('refuses a smart source with 409 and keeps it, deleteSources or not', async () => {
    const smart = await ctx.playlist('owner', {
      title: 'Computed',
      rules: { match: 'all', conditions: [], sort: 'oldest', limit: 3 },
    });

    const res = await ctx.call('owner', 'POST', '/v1/playlists/merge', {
      sourceIds: [smart],
      into: target,
      deleteSources: true,
    });

    expect([res.statusCode, res.json().code]).toEqual([409, ErrorCodes.PLAYLIST_IS_SMART]);
    expect((await ctx.call('owner', 'GET', `/v1/playlists/${smart}`)).statusCode).toBe(200);
  });

  it.each(['json', 'csv'] as const)(
    'round-trips a playlist through a %s export',
    async (format) => {
      await fill(source, [V0, V1]);
      const [first] = await itemIdsOf(source);
      await ctx.call('owner', 'PATCH', `/v1/playlists/${source}/items/${first}/annotation`, {
        note: 'Opening, with "quotes", and a comma',
      });

      const exported = (
        await ctx.call('owner', 'GET', `/v1/playlists/${source}/export?format=${format}`)
      ).json();
      const imported = await ctx.call('owner', 'POST', `/v1/playlists/${target}/import`, {
        format,
        content: exported.content,
      });

      expect(imported.json().lines.map((line: { status: string }) => line.status)).toEqual([
        'added',
        'added',
      ]);
      const copy = (await ctx.call('owner', 'GET', `/v1/playlists/${target}`)).json();
      expect(
        copy.items.map((item: { videoId: string; note: string | null }) => [
          item.videoId,
          item.note,
        ])
      ).toEqual([
        [V0, 'Opening, with "quotes", and a comma'],
        [V1, null],
      ]);
    }
  );

  it('reports each line of a URL list, and never resolves a URL of another site', async () => {
    await fill(target, [V1]);
    const web = ctx.app.config.webUrl;

    const res = await ctx.call('owner', 'POST', `/v1/playlists/${target}/import`, {
      format: 'urls',
      content: [`${web}/watch/${V0}`, V1, FOREIGN, PRIVATE_VIDEO, '', 'not a thing'].join('\n'),
    });

    expect(res.json().lines).toEqual([
      { line: 1, status: 'added', videoId: V0 },
      { line: 2, status: 'duplicate', videoId: V1 },
      { line: 3, status: 'unrecognised', videoId: null },
      { line: 4, status: 'not_found', videoId: PRIVATE_VIDEO },
      { line: 5, status: 'unrecognised', videoId: null },
    ]);
  });

  it.each([
    { scenario: 'more than 500 lines', format: 'urls', content: Array(501).fill(V0).join('\n') },
    { scenario: 'JSON that is not an export', format: 'json', content: '[1, 2]' },
    { scenario: 'text that is not JSON', format: 'json', content: '{' },
  ])('refuses $scenario with 422', async ({ format, content }) => {
    const res = await ctx.call('owner', 'POST', `/v1/playlists/${target}/import`, {
      format,
      content,
    });

    expect([res.statusCode, res.json().code]).toEqual([422, ErrorCodes.VALIDATION_FAILED]);
  });
});
