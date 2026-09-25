import type { PlaylistRepositoryPort } from '@vp/core/repositories';
import { WATCH_LATER_TITLE } from '@vp/domain';
import { expectOk } from '@vp/testing/result';
import { OWNER_ID, VIDEO_IDS, seedOwners } from './fixtures';
import {
  OWNER,
  P,
  type PlaylistContractContext,
  STRANGER,
  addAll,
  seedPlaylist,
  seedVideos,
  tick,
} from './playlist-contract-context';
import { describePlaylistItemsContract } from './playlist-items.contract';
import type { MakeRepositoriesSubject, RepositoriesSubject } from './subjects';

export function describePlaylistRepositoryContract(makeSubject: MakeRepositoriesSubject): void {
  describe('PlaylistRepository contract', () => {
    let subject: RepositoriesSubject;
    let playlists: PlaylistRepositoryPort;
    const ctx: PlaylistContractContext = {
      get subject() {
        return subject;
      },
      get playlists() {
        return playlists;
      },
    };

    beforeAll(async () => {
      subject = await makeSubject();
    });

    afterAll(async () => {
      await subject.close();
    });

    beforeEach(async () => {
      await subject.reset();
      await seedOwners(subject.repositories);
      playlists = subject.repositories.playlists;
      await seedVideos(ctx);
      await subject.repositories.channels.create({
        userId: OWNER_ID,
        handle: 'owner',
        displayName: 'The Owner',
      });
    });

    it('creates a user playlist and reads it back unscoped', async () => {
      await seedPlaylist(ctx, P.mix);

      expect(expectOk(await playlists.findById(P.mix))).toMatchObject({
        id: P.mix,
        ownerId: OWNER_ID,
        title: 'Mix',
        visibility: 'private',
        isSystem: false,
        customThumbnailKey: null,
      });
      expect(expectOk(await playlists.findById(P.absent))).toBeNull();
    });

    it('provisions one Watch Later per owner however often, or however concurrently, it is asked', async () => {
      await Promise.all([
        playlists.provisionWatchLater({ id: P.watchLater, ownerId: OWNER_ID }),
        playlists.provisionWatchLater({ id: P.other, ownerId: OWNER_ID }),
      ]);
      expectOk(await playlists.provisionWatchLater({ id: P.absent, ownerId: OWNER_ID }));

      const owned = expectOk(await playlists.listOwned(OWNER, null));
      expect(owned).toHaveLength(1);
      expect(owned[0]).toMatchObject({
        title: WATCH_LATER_TITLE,
        visibility: 'private',
        isSystem: true,
      });
    });

    it.each([
      { visibility: 'private' as const, owner: true, stranger: false, anonymous: false },
      { visibility: 'unlisted' as const, owner: true, stranger: true, anonymous: true },
      { visibility: 'public' as const, owner: true, stranger: true, anonymous: true },
    ])(
      'scopes a $visibility playlist to its readers',
      async ({ visibility, owner, stranger, anonymous }) => {
        await seedPlaylist(ctx, P.mix, visibility);

        const readable = async (viewer: typeof OWNER | null) =>
          expectOk(await playlists.findDetail(P.mix, viewer)) !== null;

        expect({
          owner: await readable(OWNER),
          stranger: await readable(STRANGER),
          anonymous: await readable(null),
        }).toEqual({ owner, stranger, anonymous });
      }
    );

    it('reads the owner channel card with the playlist', async () => {
      await seedPlaylist(ctx, P.mix, 'public');

      const detail = expectOk(await playlists.findDetail(P.mix, null));

      expect(detail?.owner).toMatchObject({ handle: 'owner', displayName: 'The Owner' });
      expect(detail?.items).toEqual([]);
    });

    it('lists Watch Later first, then by latest change, with a count and a containsVideo flag', async () => {
      expectOk(await playlists.provisionWatchLater({ id: P.watchLater, ownerId: OWNER_ID }));
      await seedPlaylist(ctx, P.mix);
      await tick();
      await seedPlaylist(ctx, P.other);
      await tick();
      await addAll(ctx, [VIDEO_IDS.a, VIDEO_IDS.b]);

      const owned = expectOk(await playlists.listOwned(OWNER, VIDEO_IDS.a));

      expect(owned.map((row) => [row.id, row.videoCount, row.containsVideo])).toEqual([
        [P.watchLater, 0, false],
        [P.mix, 2, true],
        [P.other, 0, false],
      ]);
      expect(expectOk(await playlists.listOwned(STRANGER, VIDEO_IDS.a))).toEqual([]);
    });

    it('patches the fields given and moves updatedAt', async () => {
      await seedPlaylist(ctx, P.mix);
      const before = expectOk(await playlists.findById(P.mix));
      await tick();

      const updated = expectOk(
        await playlists.update(P.mix, { title: 'Road trip', visibility: 'unlisted' })
      );

      expect(updated).toMatchObject({
        title: 'Road trip',
        visibility: 'unlisted',
        description: '',
      });
      expect(updated?.updatedAt.getTime()).toBeGreaterThan(before?.updatedAt.getTime() ?? 0);
      expect(expectOk(await playlists.update(P.absent, { title: 'x' }))).toBeNull();
    });

    it('removes a user playlist with its items and never a system one', async () => {
      await seedPlaylist(ctx, P.mix);
      await addAll(ctx, [VIDEO_IDS.a]);
      expectOk(await playlists.provisionWatchLater({ id: P.watchLater, ownerId: OWNER_ID }));

      expect(expectOk(await playlists.remove(P.mix))).toBe(true);
      expect(expectOk(await playlists.remove(P.watchLater))).toBe(false);
      expect(expectOk(await playlists.remove(P.mix))).toBe(false);
      expect(expectOk(await playlists.findById(P.watchLater))).not.toBeNull();
      expect(expectOk(await playlists.addItem(P.mix, { id: P.other, videoId: VIDEO_IDS.a }))).toBe(
        'playlist-missing'
      );
    });

    describePlaylistItemsContract(ctx);
  });
}
