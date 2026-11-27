import { expectOk } from '@kit/testing/result';
import { NO_PLAYLIST_COUNTS, type PlaylistCount } from '@vp/domain';
import { OWNER_ID, VIDEO_IDS, publicVideo, seedOwners } from './fixtures';
import { P } from './playlist-contract-context';
import type { MakeRepositoriesSubject, RepositoriesSubject } from './subjects';
import { viewBatch } from './view-batch';

const DAY = '2026-11-20';
const NEXT_DAY = '2026-11-21';
const OUTSIDE = '2026-10-01';
const { a, b, c, d, e, f } = VIDEO_IDS;
const HELD = [a, b, c, d, e];
const itemIdOf = (index: number) =>
  `00000000-0000-7000-8000-0000000007${String(index).padStart(2, '0')}`;

const count = (overrides: Partial<PlaylistCount>): PlaylistCount => ({
  ...NO_PLAYLIST_COUNTS,
  playlistId: P.mix,
  videoId: null,
  viewDate: DAY,
  ...overrides,
});

const plays = (videoId: string, played: number, viewDate = DAY) =>
  count({ videoId, plays: played, viewDate });

export function describePlaylistStatsContract(makeSubject: MakeRepositoriesSubject): void {
  describe('PlaylistStatsRepository contract, fed by the view flush', () => {
    let subject: RepositoriesSubject;

    const repos = () => subject.repositories;
    const flush = async (playlists: PlaylistCount[]) =>
      expectOk(await repos().videoViews.applyBatch(viewBatch({ playlists })));
    const stats = async (playlistId = P.mix) =>
      expectOk(await repos().playlistStats.statsOf(playlistId, { from: DAY, to: NEXT_DAY }));

    beforeAll(async () => {
      subject = await makeSubject();
    });

    afterAll(async () => {
      await subject.close();
    });

    beforeEach(async () => {
      await subject.reset();
      await seedOwners(repos());
      for (const id of [a, b, c, d, e, f]) await repos().videos.create(publicVideo({ id }));
      expectOk(
        await repos().playlists.create({
          id: P.mix,
          ownerId: OWNER_ID,
          title: 'Mix',
          description: '',
          visibility: 'public',
        })
      );
      expectOk(
        await repos().playlists.appendItems(
          P.mix,
          HELD.map((videoId, index) => ({ id: itemIdOf(index), videoId, addedBy: OWNER_ID })),
          OWNER_ID
        )
      );
    });

    it('adds the opens, plays, follows and forks of the range, across flushes', async () => {
      await flush([
        count({ opens: 3, follows: 1 }),
        plays(a, 2),
        count({ forks: 1, viewDate: NEXT_DAY }),
      ]);
      await flush([
        count({ opens: 1 }),
        plays(b, 1, NEXT_DAY),
        count({ opens: 9, viewDate: OUTSIDE }),
      ]);

      expect((await stats()).totals).toEqual({ opens: 4, plays: 3, follows: 1, forks: 1 });
    });

    it('ranks the five most played videos, ties by id, with their titles', async () => {
      await flush([
        plays(a, 1),
        plays(b, 4),
        plays(c, 2),
        plays(d, 2),
        plays(e, 1),
        plays(f, 7, OUTSIDE),
      ]);
      await flush([plays(a, 1), plays(f, 1)]);

      expect((await stats()).topItems).toEqual([
        { videoId: b, plays: 4, title: 'Video b' },
        { videoId: a, plays: 2, title: 'Video a' },
        { videoId: c, plays: 2, title: 'Video c' },
        { videoId: d, plays: 2, title: 'Video d' },
        { videoId: e, plays: 1, title: 'Video e' },
      ]);
    });

    it('counts no play of a video the playlist does not hold, and ranks none it holds no more', async () => {
      await flush([plays(a, 3), plays(b, 2), plays(f, 9), count({ opens: 1, videoId: f })]);
      expectOk(await repos().playlists.removeItem(P.mix, { by: 'video', videoId: b }, OWNER_ID));

      expect(await stats()).toEqual({
        totals: { opens: 0, plays: 5, follows: 0, forks: 0 },
        topItems: [{ videoId: a, plays: 3, title: 'Video a' }],
      });
    });

    it('leaves out a playlist deleted since the beacon, and answers zeros for one never counted', async () => {
      expectOk(await repos().playlists.remove(P.mix));

      await flush([count({ opens: 2 })]);

      expect(await stats()).toEqual({
        totals: { opens: 0, plays: 0, follows: 0, forks: 0 },
        topItems: [],
      });
    });
  });
}
