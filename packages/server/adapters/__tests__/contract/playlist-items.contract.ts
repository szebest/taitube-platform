import { movePositions } from '@vp/domain';
import { err, ok } from '@vp/result';
import { expectErr, expectOk } from '@vp/testing/result';
import { OTHER_OWNER_ID, VIDEO_IDS, publicVideo } from './fixtures';
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

      const again = await ctx.playlists.addItem(P.mix, { id: P.other, videoId: VIDEO_IDS.a });

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
      expect(expectOk(await ctx.playlists.addItem(playlistId, { id: P.other, videoId }))).toBe(
        outcome
      );
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
          ctx.playlists.addItem(P.mix, { id: numbered('04', index), videoId })
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

    it('removes a video and closes the gap it leaves', async () => {
      await addAll(ctx, FIVE);

      expect(expectOk(await ctx.playlists.removeItem(P.mix, VIDEO_IDS.b))).toBe(true);
      expect(expectOk(await ctx.playlists.removeItem(P.mix, VIDEO_IDS.b))).toBe(false);

      const detail = expectOk(await ctx.playlists.findDetail(P.mix, OWNER));
      expect(detail?.items.map((item) => [item.videoId, item.position])).toEqual([
        [VIDEO_IDS.a, 0],
        [VIDEO_IDS.c, 1],
        [VIDEO_IDS.d, 2],
        [VIDEO_IDS.e, 3],
      ]);
    });

    it.each([
      { to: 0, order: [VIDEO_IDS.e, VIDEO_IDS.a, VIDEO_IDS.b, VIDEO_IDS.c, VIDEO_IDS.d] },
      { to: 1, order: [VIDEO_IDS.a, VIDEO_IDS.e, VIDEO_IDS.b, VIDEO_IDS.c, VIDEO_IDS.d] },
    ])('moves the fifth item to place $to', async ({ to, order }) => {
      await addAll(ctx, FIVE);
      const itemId = itemIdFor(VIDEO_IDS.e);

      const moved = await ctx.playlists.reorder(P.mix, (items) =>
        ok(movePositions(items, itemId, to) ?? [])
      );

      expect(expectOk(moved)).toBe(true);
      expect(await orderOf(ctx)).toEqual(order);
    });

    it('writes nothing when the plan refuses, and hands its failure back', async () => {
      await addAll(ctx, FIVE);

      const refused = await ctx.playlists.reorder(P.mix, () => err('stale' as const));

      expect(expectErr(refused)).toBe('stale');
      expect(await orderOf(ctx)).toEqual(FIVE);
    });

    it('answers false for a playlist that is gone', async () => {
      expect(expectOk(await ctx.playlists.reorder(P.absent, () => ok([])))).toBe(false);
    });
  });
}
