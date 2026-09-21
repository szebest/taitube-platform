import type { EventRepository } from '@vp/core/ports';
import { OTHER_OWNER_ID, OWNER_ID, VIDEO_IDS, publicVideo, seedOwners } from './fixtures';
import type { MakeRepositoriesSubject, RepositoriesSubject } from './subjects';

export function describeEventRepositoryContract(makeSubject: MakeRepositoriesSubject): void {
  describe('EventRepository contract', () => {
    let subject: RepositoriesSubject;
    let events: EventRepository;

    beforeAll(async () => {
      subject = await makeSubject();
    });

    beforeEach(async () => {
      await subject.reset();
      await seedOwners(subject.repositories);
      events = subject.repositories.events;
      await subject.repositories.videos.create(publicVideo({ id: VIDEO_IDS.a }));
      await subject.repositories.videos.create(
        publicVideo({ id: VIDEO_IDS.b, ownerId: OTHER_OWNER_ID })
      );
    });

    it('stores an event and hands back a monotonic id', async () => {
      const first = await events.create({ videoId: VIDEO_IDS.a, type: 'video.uploaded' });
      const second = await events.create({
        videoId: VIDEO_IDS.a,
        type: 'video.probed',
        payload: { durationMs: 1000 },
        traceId: 'trace-1',
      });

      expect(second.id).toBeGreaterThan(first.id);
      expect(second).toMatchObject({ type: 'video.probed', traceId: 'trace-1' });
      expect(second.payload).toEqual({ durationMs: 1000 });
    });

    it('lists the events of one video only', async () => {
      await events.create({ videoId: VIDEO_IDS.a, type: 'video.uploaded' });
      await events.create({ videoId: VIDEO_IDS.b, type: 'video.uploaded' });

      expect(await events.findByVideoId(VIDEO_IDS.a)).toHaveLength(1);
      expect(await events.findByVideoId(VIDEO_IDS.f)).toEqual([]);
    });

    it('streams the events after a given id', async () => {
      const first = await events.create({ videoId: VIDEO_IDS.a, type: 'video.uploaded' });
      await events.create({ videoId: VIDEO_IDS.a, type: 'video.probed' });

      const after = await events.findAfterId(VIDEO_IDS.a, first.id);
      expect(after.map((e) => e.type)).toEqual(['video.probed']);
      expect(await events.findAfterId(VIDEO_IDS.a, Number.MAX_SAFE_INTEGER)).toEqual([]);
    });

    it('streams the events of every video an owner has', async () => {
      await events.create({ videoId: VIDEO_IDS.a, type: 'video.uploaded' });
      await events.create({ videoId: VIDEO_IDS.b, type: 'video.uploaded' });

      const mine = await events.findAfterIdForUser(OWNER_ID, 0);
      expect(mine.map((e) => e.videoId)).toEqual([VIDEO_IDS.a]);
    });

    it('reports the latest event id, or zero when there is none', async () => {
      expect(await events.getLatestEventId(VIDEO_IDS.a)).toBe(0);
      const created = await events.create({ videoId: VIDEO_IDS.a, type: 'video.uploaded' });
      expect(await events.getLatestEventId(VIDEO_IDS.a)).toBe(created.id);
    });
  });
}
