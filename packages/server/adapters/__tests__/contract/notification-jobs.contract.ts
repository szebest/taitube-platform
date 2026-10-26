import { expectOk } from '@vp/testing/result';
import { OWNER_ID, VIDEO_IDS, publicVideo, seedOwners } from './fixtures';
import type { MakeRepositoriesSubject, RepositoriesSubject } from './subjects';

const COMMENT_ID = '00000000-0000-7000-8000-0000000000c1';

export function describeNotificationJobsContract(makeSubject: MakeRepositoriesSubject): void {
  describe('notification jobs written with their cause', () => {
    let subject: RepositoriesSubject;

    const enqueued = async () => {
      const rows = expectOk(await subject.repositories.outbox.claimBatch(50));
      return rows
        .filter((row) => row.kind === 'notification')
        .map((row) => (row.payload.type === 'queue' ? row.payload.job.name : row.payload.type));
    };

    const transition = async (to: 'READY' | 'FAILED', visibility: 'public' | 'private') => {
      await subject.seedVideo(publicVideo({ id: VIDEO_IDS.a, status: 'PROCESSING', visibility }));
      expectOk(
        await subject.repositories.videos.transition({
          videoId: VIDEO_IDS.a,
          from: 'PROCESSING',
          to,
          eventType: `video.${to.toLowerCase()}`,
        })
      );
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
    });

    it.each([
      { to: 'READY', visibility: 'public', jobs: ['notify-processing', 'notify-subscribers'] },
      { to: 'READY', visibility: 'private', jobs: ['notify-processing'] },
      { to: 'FAILED', visibility: 'public', jobs: ['notify-processing'] },
    ] as const)('a video that goes $to while $visibility enqueues $jobs', async (c) => {
      await transition(c.to, c.visibility);

      expect(await enqueued()).toEqual(c.jobs);
    });

    it('enqueues nothing for a transition the video was no longer in', async () => {
      await subject.seedVideo(publicVideo({ id: VIDEO_IDS.a, status: 'READY' }));
      expectOk(
        await subject.repositories.videos.transition({
          videoId: VIDEO_IDS.a,
          from: 'PROCESSING',
          to: 'READY',
          eventType: 'video.ready',
        })
      );

      expect(await enqueued()).toEqual([]);
    });

    it('enqueues a comment job when a comment is created', async () => {
      await subject.seedVideo(publicVideo({ id: VIDEO_IDS.a }));
      expectOk(
        await subject.repositories.comments.create({
          id: COMMENT_ID,
          videoId: VIDEO_IDS.a,
          authorId: OWNER_ID,
          parentId: null,
          content: 'first',
        })
      );

      expect(await enqueued()).toEqual(['notify-comment']);
    });

    it.each([
      {
        scenario: 'a private video made public',
        from: 'private',
        to: 'public',
        jobs: ['notify-subscribers'],
      },
      { scenario: 'a public video renamed', from: 'public', to: 'public', jobs: [] },
      { scenario: 'a public video made private', from: 'public', to: 'private', jobs: [] },
    ] as const)('$scenario enqueues $jobs', async ({ from, to, jobs }) => {
      const seeded = await subject.seedVideo(publicVideo({ id: VIDEO_IDS.a, visibility: from }));
      expectOk(
        await subject.repositories.videoStudio.updateMetadata({
          videoId: VIDEO_IDS.a,
          userId: OWNER_ID,
          expectedVersion: seeded.version,
          patch: { visibility: to },
        })
      );

      expect(await enqueued()).toEqual(jobs);
    });
  });
}
