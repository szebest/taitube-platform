import { randomUUID } from 'node:crypto';
import { PLAYLIST_PREVIEW_THUMBNAILS, type PlaylistVisibility } from '@vp/domain';
import { expectOk } from '@vp/testing/result';
import { OTHER_OWNER_ID, OWNER_ID, VIDEO_IDS, publicVideo } from './fixtures';
import {
  AN_HOUR_AGO,
  P,
  type PlaylistContractContext,
  TWO_HOURS_AGO,
  seedPlaylist,
} from './playlist-contract-context';

const POSTER_VIDEOS = [1, 2, 3, 4].map((n) => `00000000-0000-7000-8000-0000000000d${n}`);
const POSTER_KEYS = POSTER_VIDEOS.map((id) => `videos/${id}/poster.jpg`);
const STRANGERS_PRIVATE_VIDEO = '00000000-0000-7000-8000-0000000000d9';
const DELETED_VIDEO = '00000000-0000-7000-8000-0000000000d8';
const STRANGERS_PLAYLIST = '00000000-0000-7000-8000-0000000001b1';
const EXTRA = ['b2', 'b3'].map((n) => `00000000-0000-7000-8000-0000000001${n}`);

export function describePlaylistPublicListingContract(ctx: PlaylistContractContext): void {
  describe('listPublicByOwner', () => {
    const list = async (limit: number, cursor: { updatedAt: Date; id: string } | null = null) =>
      expectOk(await ctx.playlists.listPublicByOwner(OWNER_ID, { cursor, limit }));

    const createPlaylist = async (id: string, visibility: PlaylistVisibility, ownerId = OWNER_ID) =>
      expectOk(
        await ctx.playlists.create({
          id,
          ownerId,
          title: `List ${id.slice(-2)}`,
          description: '',
          visibility,
        })
      );

    const add = async (playlistId: string, videoId: string) =>
      expectOk(await ctx.playlists.addItem(playlistId, { id: randomUUID(), videoId }));

    const walk = async (limit: number) => {
      const ids: string[] = [];
      let cursor: { updatedAt: Date; id: string } | null = null;
      for (;;) {
        const rows = await list(limit, cursor);
        const page = rows.slice(0, limit);
        ids.push(...page.map((row) => row.id));
        const last = page.at(-1);
        if (rows.length <= limit || !last) return ids;
        cursor = { updatedAt: last.updatedAt, id: last.id };
      }
    };

    it('lists the public playlists of the owner and nothing else', async () => {
      await createPlaylist(P.mix, 'public');
      await createPlaylist(P.other, 'private');
      await createPlaylist(EXTRA[0] as string, 'unlisted');
      await createPlaylist(STRANGERS_PLAYLIST, 'public', OTHER_OWNER_ID);
      expectOk(await ctx.playlists.provisionWatchLater({ id: P.watchLater, ownerId: OWNER_ID }));

      expect((await list(10)).map((row) => row.id)).toEqual([P.mix]);
    });

    it('counts the videos a visitor may watch and stacks the first posters in order', async () => {
      await createPlaylist(P.mix, 'public');
      const repositories = ctx.subject.repositories;
      for (const [index, id] of POSTER_VIDEOS.entries()) {
        await repositories.videos.create(publicVideo({ id, posterKey: POSTER_KEYS[index] }));
      }
      await repositories.videos.create(
        publicVideo({
          id: STRANGERS_PRIVATE_VIDEO,
          ownerId: OTHER_OWNER_ID,
          visibility: 'private',
          posterKey: 'videos/hidden/poster.jpg',
        })
      );
      await repositories.videos.create(
        publicVideo({
          id: DELETED_VIDEO,
          deletedAt: new Date(),
          status: 'DELETED',
          posterKey: 'videos/gone/poster.jpg',
        })
      );

      for (const videoId of [
        VIDEO_IDS.a,
        POSTER_VIDEOS[0] as string,
        STRANGERS_PRIVATE_VIDEO,
        DELETED_VIDEO,
        ...POSTER_VIDEOS.slice(1),
      ]) {
        await add(P.mix, videoId);
      }

      const [playlist] = await list(10);

      expect(playlist).toMatchObject({ id: P.mix, videoCount: 5 });
      expect(playlist?.posterKeys).toEqual(POSTER_KEYS.slice(0, PLAYLIST_PREVIEW_THUMBNAILS));
    });

    it('answers an empty playlist with no videos and no posters', async () => {
      await seedPlaylist(ctx, P.mix, 'public');

      expect(await list(10)).toMatchObject([{ id: P.mix, videoCount: 0, posterKeys: [] }]);
    });

    it('orders by last change, newest first, and breaks a tie on the id', async () => {
      await createPlaylist(P.mix, 'public');
      await createPlaylist(P.other, 'public');
      await createPlaylist(EXTRA[0] as string, 'public');
      await createPlaylist(EXTRA[1] as string, 'public');
      await ctx.subject.backdatePlaylist(P.mix, TWO_HOURS_AGO);
      await ctx.subject.backdatePlaylist(P.other, AN_HOUR_AGO);
      await ctx.subject.backdatePlaylist(EXTRA[0] as string, AN_HOUR_AGO);
      await ctx.subject.backdatePlaylist(
        EXTRA[1] as string,
        new Date(AN_HOUR_AGO.getTime() + 1000)
      );

      expect((await list(10)).map((row) => row.id)).toEqual([EXTRA[1], EXTRA[0], P.other, P.mix]);
    });

    it.each([1, 2, 3])(
      'walks every playlist once in pages of %i, whatever time its change was stamped at',
      async (limit) => {
        const ids = [P.mix, P.other, ...EXTRA];
        for (const id of ids) {
          await createPlaylist(id, 'public');
          await add(id, VIDEO_IDS.a);
        }
        await ctx.subject.backdatePlaylist(ids[3] as string, AN_HOUR_AGO);
        await ctx.subject.backdatePlaylist(ids[2] as string, AN_HOUR_AGO);

        const walked = await walk(limit);

        expect(walked).toHaveLength(ids.length);
        expect(new Set(walked)).toEqual(new Set(ids));
        expect(walked).toEqual((await list(10)).map((row) => row.id));
      }
    );
  });
}
