import { expectOk } from '@kit/testing/result';
import { PLAYLIST_PIN_LIMIT, type SmartPlaylistRules } from '@vp/domain';
import type { UserContext } from '@vp/permissions';
import { uuidv7 } from 'uuidv7';
import { OTHER_OWNER_ID, OWNER_ID, VIDEO_IDS, publicVideo, seedOwners } from './fixtures';
import { P } from './playlist-contract-context';
import type { MakeRepositoriesSubject, RepositoriesSubject } from './subjects';

const FOLLOWER: UserContext = { id: OTHER_OWNER_ID, role: 'USER' };
const FORK = '00000000-0000-7000-8000-0000000006a1';
const FROZEN = '00000000-0000-7000-8000-0000000006a2';
const RULES: SmartPlaylistRules = {
  match: 'all',
  conditions: [{ field: 'unwatched' }],
  sort: 'newest',
  limit: 10,
};
const { a, b, c } = VIDEO_IDS;

export function describePlaylistLibraryContract(makeSubject: MakeRepositoriesSubject): void {
  describe('PlaylistLibraryRepository contract', () => {
    let subject: RepositoriesSubject;

    const repos = () => subject.repositories;
    const library = () => repos().playlistLibrary;
    const create = (id: string, visibility: 'public' | 'private' = 'public') =>
      repos().playlists.create({
        id,
        ownerId: OWNER_ID,
        title: 'Mix',
        description: 'Why',
        visibility,
      });

    beforeAll(async () => {
      subject = await makeSubject();
    });

    afterAll(async () => {
      await subject.close();
    });

    beforeEach(async () => {
      await subject.reset();
      await seedOwners(repos());
      for (const id of [a, b, c]) await repos().videos.create(publicVideo({ id }));
      expectOk(await create(P.mix));
    });

    it('pins and unpins, and answers a playlist gone', async () => {
      const at = new Date('2026-11-01T00:00:00.000Z');

      expect(expectOk(await library().pin(OWNER_ID, P.mix, at))).toBe('pinned');
      expect(expectOk(await repos().playlists.findById(P.mix))?.pinnedAt).toEqual(at);
      expect(expectOk(await library().unpin(P.mix))).toBe(true);
      expect(expectOk(await repos().playlists.findById(P.mix))?.pinnedAt).toBeNull();
      expect(expectOk(await library().pin(OWNER_ID, P.absent, at))).toBe('missing');
      expect(expectOk(await library().unpin(P.absent))).toBe(false);
    });

    it('never lets parallel pins pass the limit, and repins a pinned one', async () => {
      const ids = Array.from({ length: PLAYLIST_PIN_LIMIT + 2 }, () => uuidv7());
      for (const id of ids) expectOk(await create(id));
      const at = new Date('2026-11-01T00:00:00.000Z');

      const outcomes = await Promise.all(
        ids.map(async (id) => expectOk(await library().pin(OWNER_ID, id, at)))
      );

      expect(outcomes.filter((outcome) => outcome === 'pinned')).toHaveLength(PLAYLIST_PIN_LIMIT);
      expect(outcomes.filter((outcome) => outcome === 'full')).toHaveLength(2);
      const pinnedId = ids[outcomes.indexOf('pinned')] ?? '';
      expect(expectOk(await library().pin(OWNER_ID, pinnedId, at))).toBe('pinned');
    });

    it('follows once, and unfollows', async () => {
      expect(expectOk(await library().follow(OTHER_OWNER_ID, P.mix))).toBe('followed');
      expect(expectOk(await library().follow(OTHER_OWNER_ID, P.mix))).toBe('present');
      expect(expectOk(await library().follow(OTHER_OWNER_ID, P.absent))).toBe('playlist-missing');
      expect(expectOk(await library().unfollow(OTHER_OWNER_ID, P.mix))).toBe(true);
      expect(expectOk(await library().unfollow(OTHER_OWNER_ID, P.mix))).toBe(false);
    });

    it('lists a followed playlist live, and as gone once it turns private', async () => {
      expectOk(
        await repos().playlists.addItem(
          P.mix,
          { id: '00000000-0000-7000-8000-0000000006b4', videoId: a, addedBy: OWNER_ID },
          OWNER_ID
        )
      );
      expectOk(await library().follow(OTHER_OWNER_ID, P.mix));
      const list = async () =>
        expectOk(await library().listFollowed(FOLLOWER, { cursor: null, limit: 10 }));

      expect(await list()).toEqual([
        expect.objectContaining({
          playlistId: P.mix,
          playlist: expect.objectContaining({
            title: 'Mix',
            visibility: 'public',
            isSmart: false,
            videoCount: 1,
            owner: expect.objectContaining({ handle: 'owner' }),
          }),
        }),
      ]);

      expectOk(await repos().playlists.update(P.mix, { visibility: 'private' }, OWNER_ID));

      expect(await list()).toEqual([
        expect.objectContaining({ playlistId: P.mix, playlist: null }),
      ]);
    });

    it('walks the followed playlists newest first, one page after another', async () => {
      expectOk(await create(P.other));
      expectOk(await library().follow(OTHER_OWNER_ID, P.mix));
      expectOk(await library().follow(OTHER_OWNER_ID, P.other));
      const all = expectOk(await library().listFollowed(FOLLOWER, { cursor: null, limit: 10 }));
      const [first, second] = all;
      if (!(first && second)) throw new Error('two follows are listed');
      const rest = expectOk(
        await library().listFollowed(FOLLOWER, {
          cursor: { followedAt: first.followedAt, playlistId: first.playlistId },
          limit: 10,
        })
      );

      expect(rest.map((row) => row.playlistId)).toEqual([second.playlistId]);
    });

    it('forks the items, notes, segments, sections and rules into a private copy that credits its source', async () => {
      expectOk(
        await repos().playlists.addItem(
          P.mix,
          {
            id: '00000000-0000-7000-8000-0000000006b1',
            videoId: a,
            addedBy: OWNER_ID,
            note: 'Start here',
            startMs: 1000,
            endMs: 5000,
          },
          OWNER_ID
        )
      );
      expectOk(
        await repos().playlists.addSection(
          P.mix,
          { id: '00000000-0000-7000-8000-0000000006b2', title: 'Part two', addedBy: OWNER_ID },
          OWNER_ID
        )
      );
      expectOk(
        await repos().playlists.addItem(
          P.mix,
          { id: '00000000-0000-7000-8000-0000000006b3', videoId: b, addedBy: OWNER_ID },
          OWNER_ID
        )
      );

      const fork = expectOk(
        await library().fork(P.mix, { id: FORK, ownerId: OTHER_OWNER_ID, title: 'My mix' })
      );
      const rows = expectOk(await repos().playlists.findItems(FORK));

      expect(fork).toMatchObject({
        id: FORK,
        ownerId: OTHER_OWNER_ID,
        title: 'My mix',
        description: 'Why',
        visibility: 'private',
        forkedFromPlaylistId: P.mix,
      });
      expect(
        rows.map(({ kind, videoId, title, note, startMs, endMs, addedBy }) => ({
          kind,
          videoId,
          title,
          note,
          startMs,
          endMs,
          addedBy,
        }))
      ).toEqual([
        {
          kind: 'video',
          videoId: a,
          title: null,
          note: 'Start here',
          startMs: 1000,
          endMs: 5000,
          addedBy: OTHER_OWNER_ID,
        },
        {
          kind: 'section',
          videoId: null,
          title: 'Part two',
          note: null,
          startMs: null,
          endMs: null,
          addedBy: OTHER_OWNER_ID,
        },
        {
          kind: 'video',
          videoId: b,
          title: null,
          note: null,
          startMs: null,
          endMs: null,
          addedBy: OTHER_OWNER_ID,
        },
      ]);
      expect(expectOk(await repos().playlists.findItems(P.mix))).toHaveLength(3);
    });

    it('forks the rules of a smart playlist, and nothing from a playlist that is gone', async () => {
      expectOk(await repos().playlists.update(P.mix, { rules: RULES }, OWNER_ID));

      expect(
        expectOk(await library().fork(P.mix, { id: FORK, ownerId: OTHER_OWNER_ID, title: 'Mine' }))
          ?.rules
      ).toEqual(RULES);
      expect(
        expectOk(
          await library().fork(P.absent, { id: FROZEN, ownerId: OTHER_OWNER_ID, title: 'x' })
        )
      ).toBeNull();
    });

    it('freezes videos into a normal private playlist, in order', async () => {
      const frozen = expectOk(
        await library().freeze(
          { id: FROZEN, ownerId: OTHER_OWNER_ID, title: 'Frozen', description: 'Then' },
          [c, a]
        )
      );
      const rows = expectOk(await repos().playlists.findItems(FROZEN));

      expect(frozen).toMatchObject({ visibility: 'private', rules: null, description: 'Then' });
      expect(rows.map((row) => [row.videoId, row.addedBy])).toEqual([
        [c, OTHER_OWNER_ID],
        [a, OTHER_OWNER_ID],
      ]);
    });
  });
}
