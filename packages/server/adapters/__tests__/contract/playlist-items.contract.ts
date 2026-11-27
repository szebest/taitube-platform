import { err, ok } from '@kit/result';
import { expectErr, expectOk } from '@kit/testing/result';
import { movePositions } from '@vp/domain';
import { OTHER_OWNER_ID, OWNER_ID, VIDEO_IDS, publicVideo } from './fixtures';
import {
  FIVE,
  OWNER,
  P,
  type PlaylistContractContext,
  STRANGER,
  addAll,
  itemIdFor,
  orderOf,
  seedPlaylist,
} from './playlist-contract-context';

const STRANGERS_PRIVATE_VIDEO = '00000000-0000-7000-8000-0000000000f9';

export function describePlaylistItemsContract(ctx: PlaylistContractContext): void {
  describe('items', () => {
    beforeEach(async () => {
      await seedPlaylist(ctx, P.mix, 'public');
    });

    it('appends in order and numbers the places from zero', async () => {
      await addAll(ctx, FIVE);

      const detail = expectOk(await ctx.playlists.findDetail(P.mix, OWNER));

      expect(detail?.items.map((item) => [item.videoId, item.position])).toEqual(
        FIVE.map((videoId, index) => [videoId, index])
      );
      expect(detail?.items[0]?.video).toMatchObject({ id: VIDEO_IDS.a, status: 'READY' });
      expect(detail?.items[0]?.channel).toMatchObject({ handle: 'owner' });
    });

    it('answers a video already there as present, and writes nothing', async () => {
      await addAll(ctx, [VIDEO_IDS.a]);

      const again = await ctx.playlists.addItem(
        P.mix,
        { id: P.other, videoId: VIDEO_IDS.a, addedBy: OWNER_ID },
        OWNER_ID
      );

      expect(expectOk(again)).toBe('present');
      expect(await orderOf(ctx)).toEqual([VIDEO_IDS.a]);
    });

    it.each([
      {
        scenario: 'a playlist that is gone',
        playlistId: P.absent,
        videoId: VIDEO_IDS.a,
        outcome: 'playlist-missing',
      },
      {
        scenario: 'a video that is gone',
        playlistId: P.mix,
        videoId: P.absent,
        outcome: 'video-missing',
      },
    ])('reports $scenario as $outcome', async ({ playlistId, videoId, outcome }) => {
      expect(
        expectOk(
          await ctx.playlists.addItem(
            playlistId,
            { id: P.other, videoId, addedBy: OWNER_ID },
            OWNER_ID
          )
        )
      ).toBe(outcome);
    });

    it('gives ten concurrent appends ten distinct places', async () => {
      const numbered = (block: string, index: number) =>
        `00000000-0000-7000-8000-000000${block}${index.toString().padStart(4, '0')}`;
      const ids = Array.from({ length: 10 }, (_, index) => numbered('03', index));
      for (const id of ids) {
        await ctx.subject.repositories.videos.create(publicVideo({ id }));
      }

      await Promise.all(
        ids.map((videoId, index) =>
          ctx.playlists.addItem(
            P.mix,
            { id: numbered('04', index), videoId, addedBy: OWNER_ID },
            OWNER_ID
          )
        )
      );

      const detail = expectOk(await ctx.playlists.findDetail(P.mix, OWNER));
      expect(detail?.items.map((item) => item.position)).toEqual(ids.map((_, index) => index));
      expect(new Set(detail?.items.map((item) => item.videoId))).toEqual(new Set(ids));
    });

    it('hides a video the viewer may not watch but keeps its place', async () => {
      await ctx.subject.repositories.videos.create(
        publicVideo({ id: STRANGERS_PRIVATE_VIDEO, ownerId: OTHER_OWNER_ID, visibility: 'private' })
      );
      await addAll(ctx, [VIDEO_IDS.a, STRANGERS_PRIVATE_VIDEO, VIDEO_IDS.b]);

      const places = async (viewer: typeof OWNER) =>
        expectOk(await ctx.playlists.findDetail(P.mix, viewer))?.items.map((item) => item.position);

      expect(await places(OWNER)).toEqual([0, 2]);
      expect(await places(STRANGER)).toEqual([0, 1, 2]);
    });

    it('lists the owner of every item, including a video the viewer may not watch', async () => {
      await ctx.subject.repositories.videos.create(
        publicVideo({ id: STRANGERS_PRIVATE_VIDEO, ownerId: OTHER_OWNER_ID, visibility: 'private' })
      );
      await addAll(ctx, [VIDEO_IDS.a, STRANGERS_PRIVATE_VIDEO]);

      const owners = expectOk(await ctx.playlists.listItemOwners(P.mix));

      expect(owners).toEqual(
        expect.arrayContaining([
          { id: VIDEO_IDS.a, ownerId: OWNER.id },
          { id: STRANGERS_PRIVATE_VIDEO, ownerId: OTHER_OWNER_ID },
        ])
      );
      expect(owners).toHaveLength(2);
    });

    it('removes a video and closes the gap it leaves', async () => {
      await addAll(ctx, FIVE);

      expect(
        expectOk(
          await ctx.playlists.removeItem(P.mix, { by: 'video', videoId: VIDEO_IDS.b }, OWNER_ID)
        )
      ).toBe(true);
      expect(
        expectOk(
          await ctx.playlists.removeItem(P.mix, { by: 'video', videoId: VIDEO_IDS.b }, OWNER_ID)
        )
      ).toBe(false);

      const detail = expectOk(await ctx.playlists.findDetail(P.mix, OWNER));
      expect(detail?.items.map((item) => [item.videoId, item.position])).toEqual([
        [VIDEO_IDS.a, 0],
        [VIDEO_IDS.c, 1],
        [VIDEO_IDS.d, 2],
        [VIDEO_IDS.e, 3],
      ]);
    });

    it('restores a removed section once', async () => {
      const section = { id: itemIdFor('5e'), title: 'Part 1', addedBy: OWNER_ID };
      expect(expectOk(await ctx.playlists.addSection(P.mix, section, OWNER_ID))).toBe(true);
      expectOk(await ctx.playlists.removeItem(P.mix, { by: 'item', itemId: section.id }, OWNER_ID));
      const [removal] = expectOk(
        await ctx.subject.repositories.playlistActivity.list(P.mix, { cursor: null, limit: 1 })
      );
      if (removal?.action !== 'item_removed') throw new Error('the removal was not logged');

      const outcomes = [
        expectOk(await ctx.playlists.restoreItem(P.mix, removal, OWNER_ID)),
        expectOk(await ctx.playlists.restoreItem(P.mix, removal, OWNER_ID)),
      ];

      expect(outcomes).toEqual(['restored', 'present']);
      expect(expectOk(await ctx.playlists.findItems(P.mix))).toHaveLength(1);
    });

    it('merges every source, deleting only those asked whose every item landed', async () => {
      await addAll(ctx, [VIDEO_IDS.a, VIDEO_IDS.b]);
      await seedPlaylist(ctx, P.other);
      await seedPlaylist(ctx, P.watchLater);
      const items = expectOk(await ctx.playlists.findItems(P.mix));
      const [first] = items;
      if (!first) throw new Error('the source holds no items');
      const gone = { ...first, id: itemIdFor('ff') };

      const merged = expectOk(
        await ctx.playlists.merge(
          P.watchLater,
          [
            { sourceId: P.mix, items, deleteIfLanded: true },
            { sourceId: P.other, items: [gone], deleteIfLanded: true },
          ],
          OWNER_ID
        )
      );

      expect(merged?.get(P.other)?.get(gone.id)).toBe('source-missing');
      expect(expectOk(await ctx.playlists.findById(P.mix))).toBeNull();
      expect(expectOk(await ctx.playlists.findById(P.other))).not.toBeNull();
      expect(
        expectOk(await ctx.playlists.findItems(P.watchLater)).map((item) => item.videoId)
      ).toEqual([VIDEO_IDS.a, VIDEO_IDS.b]);
    });

    it.each([
      { to: 0, order: [VIDEO_IDS.e, VIDEO_IDS.a, VIDEO_IDS.b, VIDEO_IDS.c, VIDEO_IDS.d] },
      { to: 1, order: [VIDEO_IDS.a, VIDEO_IDS.e, VIDEO_IDS.b, VIDEO_IDS.c, VIDEO_IDS.d] },
    ])('moves the fifth item to place $to', async ({ to, order }) => {
      await addAll(ctx, FIVE);
      const itemId = itemIdFor(VIDEO_IDS.e);

      const moved = await ctx.playlists.reorder(P.mix, OWNER, (items) =>
        ok(movePositions(items, itemId, to) ?? [])
      );

      expect(expectOk(moved)).toBe(true);
      expect(await orderOf(ctx)).toEqual(order);
    });

    it('writes nothing when the plan refuses, and hands its failure back', async () => {
      await addAll(ctx, FIVE);

      const refused = await ctx.playlists.reorder(P.mix, OWNER, () => err('stale' as const));

      expect(expectErr(refused)).toBe('stale');
      expect(await orderOf(ctx)).toEqual(FIVE);
    });

    it('answers false for a playlist that is gone', async () => {
      expect(expectOk(await ctx.playlists.reorder(P.absent, OWNER, () => ok([])))).toBe(false);
    });

    it('flags the slots whose video the viewer may not watch', async () => {
      await ctx.subject.repositories.videos.create(
        publicVideo({ id: STRANGERS_PRIVATE_VIDEO, ownerId: OTHER_OWNER_ID, visibility: 'private' })
      );
      await addAll(ctx, [VIDEO_IDS.a, STRANGERS_PRIVATE_VIDEO]);
      const seen: { viewer: string; hidden: boolean[] }[] = [];

      for (const viewer of [OWNER, STRANGER]) {
        await ctx.playlists.reorder(P.mix, viewer, (slots) => {
          seen.push({ viewer: viewer.id, hidden: slots.map((slot) => slot.hidden) });
          return ok([]);
        });
      }

      expect(seen).toEqual([
        { viewer: OWNER.id, hidden: [false, true] },
        { viewer: STRANGER.id, hidden: [false, false] },
      ]);
    });

    it('lets a removal and a reorder of the same playlist both land', async () => {
      await addAll(ctx, FIVE);
      const moved = itemIdFor(VIDEO_IDS.e);

      const [removed, reordered] = await Promise.all([
        ctx.playlists.removeItem(P.mix, { by: 'video', videoId: VIDEO_IDS.b }, OWNER_ID),
        ctx.playlists.reorder(P.mix, OWNER, (items) => ok(movePositions(items, moved, 0) ?? [])),
      ]);

      expect([expectOk(removed), expectOk(reordered)]).toEqual([true, true]);
      expect(await orderOf(ctx)).toEqual([VIDEO_IDS.e, VIDEO_IDS.a, VIDEO_IDS.c, VIDEO_IDS.d]);
    });
  });
}
