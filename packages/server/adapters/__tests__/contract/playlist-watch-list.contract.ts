import { ok } from '@kit/result';
import { expectOk } from '@kit/testing/result';
import { OTHER_OWNER_ID, OWNER_ID, VIDEO_IDS, publicVideo, seedOwners } from './fixtures';
import { P } from './playlist-contract-context';
import type { MakeRepositoriesSubject, RepositoriesSubject } from './subjects';

const { a, b } = VIDEO_IDS;
const ITEM_A = '00000000-0000-7000-8000-0000000007a1';
const ITEM_B = '00000000-0000-7000-8000-0000000007a2';
const LINK = '00000000-0000-7000-8000-0000000007a3';
const NOW = new Date();

export function describePlaylistWatchListContract(makeSubject: MakeRepositoriesSubject): void {
  describe('auto_remove_watched, on the history write', () => {
    let subject: RepositoriesSubject;

    const repos = () => subject.repositories;
    const watch = (videoId: string, progressSeconds: number, userId = OWNER_ID) =>
      repos().watchHistory.record({
        id: `00000000-0000-7000-8000-0000000007b${videoId.slice(-1)}`,
        userId,
        videoId,
        progressSeconds,
        durationSeconds: 100,
        watchedAt: NOW,
      });
    const held = async () =>
      expectOk(await repos().playlists.findItems(P.mix)).map((row) => row.videoId);
    const actions = async () =>
      expectOk(await repos().playlistActivity.list(P.mix, { cursor: null, limit: 50 })).map(
        (row) => row.action
      );

    beforeAll(async () => {
      subject = await makeSubject();
    });

    afterAll(async () => {
      await subject.close();
    });

    beforeEach(async () => {
      await subject.reset();
      await seedOwners(repos());
      for (const id of [a, b]) await repos().videos.create(publicVideo({ id }));
      expectOk(
        await repos().playlists.create({
          id: P.mix,
          ownerId: OWNER_ID,
          title: 'This weekend',
          description: '',
          visibility: 'private',
        })
      );
      for (const [id, videoId] of [
        [ITEM_A, a],
        [ITEM_B, b],
      ] as const) {
        expectOk(
          await repos().playlists.addItem(P.mix, { id, videoId, addedBy: OWNER_ID }, OWNER_ID)
        );
      }
      expectOk(await repos().playlists.update(P.mix, { autoRemoveWatched: true }, OWNER_ID));
    });

    it('removes a video once the owner has watched 92 percent of it, and logs it to restore', async () => {
      expectOk(await watch(a, 91));

      expect(await held()).toEqual([a, b]);

      expectOk(await watch(a, 92));

      expect(await held()).toEqual([b]);
      expect((await actions())[0]).toBe('auto_removed');
    });

    it('leaves the list alone for another viewer, and when the option is off', async () => {
      expectOk(await watch(a, 100, OTHER_OWNER_ID));
      expectOk(await repos().playlists.update(P.mix, { autoRemoveWatched: false }, OWNER_ID));
      expectOk(await watch(b, 100));

      expect(await held()).toEqual([a, b]);
    });

    it('stops once someone joins the list, and logs that it stopped', async () => {
      expectOk(
        await repos().playlistCollaborators.createInvite({
          id: LINK,
          playlistId: P.mix,
          role: 'contributor',
          token: 'w'.repeat(22),
          inviteeUserId: null,
          createdBy: OWNER_ID,
          expiresAt: new Date(NOW.getTime() + 86_400_000),
          maxUses: null,
          useCount: 0,
          revokedAt: null,
          createdAt: NOW,
        })
      );
      expectOk(
        await repos().playlistCollaborators.accept('w'.repeat(22), OTHER_OWNER_ID, ({ invite }) =>
          ok({ playlistId: invite?.playlistId ?? P.mix, role: 'contributor' as const })
        )
      );

      expectOk(await watch(a, 100));

      expect(await held()).toEqual([a, b]);
      expect(expectOk(await repos().playlists.findById(P.mix))?.autoRemoveWatched).toBe(false);
      expect(await actions()).toEqual(
        expect.arrayContaining(['collaborator_added', 'settings_changed'])
      );
    });
  });
}
