import { randomUUID } from 'node:crypto';
import type { Repositories } from '@vp/core/repositories';
import { expectOk } from '@vp/testing/result';
import { OTHER_OWNER_ID, OWNER_ID, publicVideo, seedOwners, VIDEO_IDS } from './fixtures';
import type { MakeRepositoriesSubject, RepositoriesSubject } from './subjects';

export function describeChannelStatsContract(makeSubject: MakeRepositoriesSubject): void {
  describe('ChannelRepository stats contract', () => {
    let subject: RepositoriesSubject;
    let repositories: Repositories;

    beforeAll(async () => {
      subject = await makeSubject();
    });

    afterAll(async () => {
      await subject.close();
    });

    beforeEach(async () => {
      await subject.reset();
      repositories = subject.repositories;
      await seedOwners(repositories);
    });

    const statsOf = async () => expectOk(await repositories.channels.statsOf(OWNER_ID));

    const view = async (videoId: string, views: number) =>
      expectOk(
        await repositories.videoViews.applyBatch({
          batchId: randomUUID(),
          counts: [{ videoId, viewDate: '2026-03-10', views, watchSeconds: views * 10 }],
        })
      );

    const makePublic = async (videoId: string) => {
      const video = expectOk(await repositories.videos.findById(videoId));
      return expectOk(
        await repositories.videoStudio.updateMetadata({
          videoId,
          expectedVersion: video?.version ?? 0,
          patch: { visibility: 'public' },
          userId: OWNER_ID,
        })
      );
    };

    it('answers zero for an owner with no videos', async () => {
      expect(await statsOf()).toEqual({ videoCount: 0, totalViews: 0 });
    });

    it.each([
      { name: 'a public ready video', video: {}, expected: { videoCount: 1, totalViews: 5 } },
      {
        name: 'a private video',
        video: { visibility: 'private' as const },
        expected: { videoCount: 0, totalViews: 0 },
      },
      {
        name: 'an unlisted video',
        video: { visibility: 'unlisted' as const },
        expected: { videoCount: 0, totalViews: 0 },
      },
      {
        name: 'a processing video',
        video: { status: 'PROCESSING' as const },
        expected: { videoCount: 0, totalViews: 0 },
      },
      {
        name: 'a deleted video',
        video: { status: 'DELETED' as const, deletedAt: new Date() },
        expected: { videoCount: 0, totalViews: 0 },
      },
      {
        name: "another owner's public video",
        video: { ownerId: OTHER_OWNER_ID },
        expected: { videoCount: 0, totalViews: 0 },
      },
    ])(
      'derives the stats of an owner holding $name that the flush gave 5 views',
      async ({ video, expected }) => {
        await subject.seedVideo(publicVideo({ id: VIDEO_IDS.a, ...video }));
        await view(VIDEO_IDS.a, 5);

        expect(await statsOf()).toEqual(expected);
      }
    );

    it('adds every flush to the views of the counted videos', async () => {
      await subject.seedVideo(publicVideo({ id: VIDEO_IDS.a }));
      await subject.seedVideo(publicVideo({ id: VIDEO_IDS.b }));
      await subject.seedVideo(publicVideo({ id: VIDEO_IDS.c, visibility: 'private' }));

      await view(VIDEO_IDS.a, 5);
      await view(VIDEO_IDS.a, 2);
      await view(VIDEO_IDS.b, 1);
      await view(VIDEO_IDS.c, 40);

      expect(await statsOf()).toEqual({ videoCount: 2, totalViews: 8 });
    });

    it('counts a video, with the views it already has, when it is published', async () => {
      await subject.seedVideo(publicVideo({ id: VIDEO_IDS.a, status: 'PROCESSING' }));
      await view(VIDEO_IDS.a, 9);

      expectOk(
        await repositories.videos.transition({
          videoId: VIDEO_IDS.a,
          from: 'PROCESSING',
          to: 'READY',
          eventType: 'video.ready',
        })
      );

      expect(await statsOf()).toEqual({ videoCount: 1, totalViews: 9 });
    });

    it('counts a private video once the creator makes it public', async () => {
      await subject.seedVideo(publicVideo({ id: VIDEO_IDS.a, visibility: 'private' }));
      await view(VIDEO_IDS.a, 3);

      await makePublic(VIDEO_IDS.a);

      expect(await statsOf()).toEqual({ videoCount: 1, totalViews: 3 });
    });

    it('drops a video and its views when it is deleted', async () => {
      await subject.seedVideo(publicVideo({ id: VIDEO_IDS.a }));
      await subject.seedVideo(publicVideo({ id: VIDEO_IDS.b }));
      await view(VIDEO_IDS.a, 4);
      await view(VIDEO_IDS.b, 6);

      expectOk(
        await repositories.videos.transition({
          videoId: VIDEO_IDS.a,
          from: 'READY',
          to: 'DELETED',
          eventType: 'video.deleted',
          patch: { deletedAt: new Date() },
        })
      );

      expect(await statsOf()).toEqual({ videoCount: 1, totalViews: 6 });
    });
  });
}
