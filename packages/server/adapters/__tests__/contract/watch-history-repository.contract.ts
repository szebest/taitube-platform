import type { WatchHistoryRepositoryPort } from '@vp/core/repositories';
import type { WatchHistoryEntry } from '@vp/domain';
import type { UserContext } from '@vp/permissions';
import { expectOk } from '@vp/testing/result';
import { HOUR_MS, OTHER_OWNER_ID, OWNER_ID, VIDEO_IDS, publicVideo, seedOwners } from './fixtures';
import type { MakeRepositoriesSubject, RepositoriesSubject } from './subjects';

const VIEWER: UserContext = { id: OTHER_OWNER_ID, role: 'USER' };
const BASE = Date.parse('2026-03-01T12:00:00.000Z');

const rowId = (videoId: string) => `00000000-0000-7000-8000-0000000005${videoId.slice(-2)}`;

function progress(videoId: string, progressSeconds: number, hoursAgo = 0) {
  return {
    id: rowId(videoId),
    userId: VIEWER.id,
    videoId,
    progressSeconds,
    durationSeconds: 600,
    watchedAt: new Date(BASE - hoursAgo * HOUR_MS),
  };
}

const videosOf = (entries: readonly WatchHistoryEntry[]) => entries.map((entry) => entry.videoId);

export function describeWatchHistoryRepositoryContract(makeSubject: MakeRepositoriesSubject): void {
  describe('WatchHistoryRepository contract', () => {
    let subject: RepositoriesSubject;
    let history: WatchHistoryRepositoryPort;

    beforeAll(async () => {
      subject = await makeSubject();
    });

    afterAll(async () => {
      await subject.close();
    });

    beforeEach(async () => {
      await subject.reset();
      await seedOwners(subject.repositories);
      history = subject.repositories.watchHistory;
      for (const id of Object.values(VIDEO_IDS)) {
        await subject.repositories.videos.create(publicVideo({ id }));
      }
      await subject.repositories.channels.create({
        userId: OWNER_ID,
        handle: 'owner',
        displayName: 'The Owner',
      });
    });

    it('records a playhead and finds it again', async () => {
      expectOk(await history.record(progress(VIDEO_IDS.a, 45)));

      expect(expectOk(await history.find(VIEWER.id, VIDEO_IDS.a))).toEqual({
        videoId: VIDEO_IDS.a,
        progressSeconds: 45,
        durationSeconds: 600,
        watchedAt: new Date(BASE),
      });
      expect(expectOk(await history.find(VIEWER.id, VIDEO_IDS.b))).toBeNull();
    });

    it('keeps one row per video, moved forward by a newer write and never back by an older one', async () => {
      expectOk(await history.record(progress(VIDEO_IDS.a, 45, 2)));
      expectOk(await history.record(progress(VIDEO_IDS.a, 90, 1)));
      expectOk(await history.record(progress(VIDEO_IDS.a, 10, 3)));

      expect(expectOk(await history.find(VIEWER.id, VIDEO_IDS.a))?.progressSeconds).toBe(90);
      expect(expectOk(await history.list(VIEWER, { cursor: null, limit: 10 }))).toHaveLength(1);
    });

    it('lists newest first with the video and its channel, and walks on from a cursor', async () => {
      expectOk(await history.record(progress(VIDEO_IDS.a, 10, 3)));
      expectOk(await history.record(progress(VIDEO_IDS.b, 20, 1)));
      expectOk(await history.record(progress(VIDEO_IDS.c, 30, 2)));

      const first = expectOk(await history.list(VIEWER, { cursor: null, limit: 1 }));
      const last = first[0];
      const rest = last
        ? expectOk(
            await history.list(VIEWER, {
              cursor: { watchedAt: last.watchedAt, id: last.id },
              limit: 5,
            })
          )
        : [];

      expect(videosOf(first)).toEqual([VIDEO_IDS.b, VIDEO_IDS.c]);
      expect(first[0]?.video).toMatchObject({ id: VIDEO_IDS.b, status: 'READY' });
      expect(first[0]?.channel).toMatchObject({ handle: 'owner' });
      expect(videosOf(rest)).toEqual([VIDEO_IDS.c, VIDEO_IDS.a]);
    });

    it('drops a video the viewer may no longer watch, and one that was deleted', async () => {
      const hidden = '00000000-0000-7000-8000-0000000000f7';
      const deleted = '00000000-0000-7000-8000-0000000000f8';
      await subject.repositories.videos.create(publicVideo({ id: hidden, visibility: 'private' }));
      await subject.repositories.videos.create(publicVideo({ id: deleted, status: 'DELETED' }));
      for (const videoId of [hidden, deleted, VIDEO_IDS.c]) {
        expectOk(await history.record(progress(videoId, 10)));
      }

      const listed = expectOk(await history.list(VIEWER, { cursor: null, limit: 10 }));

      expect(videosOf(listed)).toEqual([VIDEO_IDS.c]);
    });

    it('removes one video, and then everything, answering what went', async () => {
      for (const videoId of [VIDEO_IDS.a, VIDEO_IDS.b]) {
        expectOk(await history.record(progress(videoId, 10)));
      }
      expectOk(
        await history.record({
          ...progress(VIDEO_IDS.c, 5),
          id: rowId(VIDEO_IDS.f),
          userId: OWNER_ID,
        })
      );

      expect(expectOk(await history.remove(VIEWER.id, VIDEO_IDS.a))).toBe(true);
      expect(expectOk(await history.remove(VIEWER.id, VIDEO_IDS.a))).toBe(false);
      expect(expectOk(await history.removeAll(VIEWER.id))).toEqual([VIDEO_IDS.b]);
      expect(expectOk(await history.find(OWNER_ID, VIDEO_IDS.c))).not.toBeNull();
    });
  });
}
