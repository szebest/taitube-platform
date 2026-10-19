import { randomUUID } from 'node:crypto';
import type { Repositories } from '@vp/core/repositories';
import { expectOk } from '@vp/testing/result';
import { OTHER_OWNER_ID, OWNER_ID, VIDEO_IDS, publicVideo, seedOwners } from './fixtures';
import type { MakeRepositoriesSubject, RepositoriesSubject } from './subjects';

const CHANNEL_ID = '00000000-0000-7000-8000-000000000301';

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

    const createChannel = async () =>
      expectOk(
        await repositories.channels.create({
          id: CHANNEL_ID,
          userId: OWNER_ID,
          handle: 'ownerhandle',
          displayName: 'Owner',
        })
      );

    const statsOf = async () => {
      const channel = expectOk(await repositories.channels.findById(CHANNEL_ID));
      return { videoCount: channel?.videoCount, totalViews: channel?.totalViews };
    };

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

    it('starts a new channel at zero', async () => {
      await createChannel();

      expect(await statsOf()).toEqual({ videoCount: 0, totalViews: 0 });
    });

    it('counts a channel created after its owner already published', async () => {
      await subject.seedVideo(publicVideo({ id: VIDEO_IDS.a, viewsCount: 7 }));
      await createChannel();

      expect(await statsOf()).toEqual({ videoCount: 1, totalViews: 7 });
    });

    it('counts only the public, ready, undeleted videos the owner holds', async () => {
      await createChannel();
      await subject.seedVideo(publicVideo({ id: VIDEO_IDS.a }));
      await subject.seedVideo(publicVideo({ id: VIDEO_IDS.b }));
      await subject.seedVideo(publicVideo({ id: VIDEO_IDS.c, visibility: 'private' }));
      await subject.seedVideo(publicVideo({ id: VIDEO_IDS.d, visibility: 'unlisted' }));
      await subject.seedVideo(publicVideo({ id: VIDEO_IDS.e, status: 'PROCESSING' }));
      await subject.seedVideo(publicVideo({ id: VIDEO_IDS.f, ownerId: OTHER_OWNER_ID }));

      expect(await statsOf()).toEqual({ videoCount: 2, totalViews: 0 });
    });

    it('adds the views a flush applies to counted videos only', async () => {
      await createChannel();
      await subject.seedVideo(publicVideo({ id: VIDEO_IDS.a }));
      await subject.seedVideo(publicVideo({ id: VIDEO_IDS.b, visibility: 'private' }));

      await view(VIDEO_IDS.a, 5);
      await view(VIDEO_IDS.a, 2);
      await view(VIDEO_IDS.b, 40);

      expect(await statsOf()).toEqual({ videoCount: 1, totalViews: 7 });
    });

    it('counts a video, with the views it already has, when it is published', async () => {
      await createChannel();
      await subject.seedVideo(publicVideo({ id: VIDEO_IDS.a, status: 'PROCESSING' }));
      await view(VIDEO_IDS.a, 9);

      expect(
        expectOk(
          await repositories.videos.transition({
            videoId: VIDEO_IDS.a,
            from: 'PROCESSING',
            to: 'READY',
            eventType: 'video.ready',
          })
        )
      ).toBe(true);

      expect(await statsOf()).toEqual({ videoCount: 1, totalViews: 9 });
    });

    it('counts a private video, with its views, once the creator makes it public', async () => {
      await createChannel();
      await subject.seedVideo(publicVideo({ id: VIDEO_IDS.a, visibility: 'private' }));
      await view(VIDEO_IDS.a, 3);

      await makePublic(VIDEO_IDS.a);

      expect(await statsOf()).toEqual({ videoCount: 1, totalViews: 3 });
    });

    it('drops a video and its views when it is deleted', async () => {
      await createChannel();
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
