import { expectOk } from '@kit/testing/result';
import type { VideoExperimentRepository } from '@vp/core/repositories';
import type { Experiment } from '@vp/domain';
import { experiment, experimentId } from './access-fixtures';
import { OTHER_OWNER_ID, OWNER_ID, publicVideo, seedOwners, VIDEO_IDS } from './fixtures';
import type { MakeRepositoriesSubject, RepositoriesSubject } from './subjects';

const ENDED_AT = new Date('2026-03-05T00:00:00.000Z');

export function describeVideoExperimentRepositoryContract(
  makeSubject: MakeRepositoriesSubject
): void {
  describe('VideoExperimentRepository contract', () => {
    let subject: RepositoriesSubject;
    let experiments: VideoExperimentRepository;

    const create = async (row: Experiment, ownerId = OWNER_ID, limit = 5) =>
      expectOk(await experiments.create(row, ownerId, limit));
    const end = async (videoId: string, n: number, winner: 'a' | 'b' | null = null) =>
      expectOk(
        await experiments.end(videoId, experimentId(n), {
          status: winner ? 'finished' : 'stopped',
          winnerVariantId: winner,
          at: ENDED_AT,
        })
      );

    beforeAll(async () => {
      subject = await makeSubject();
    });

    afterAll(async () => {
      await subject.close();
    });

    beforeEach(async () => {
      await subject.reset();
      await seedOwners(subject.repositories);
      await subject.seedVideo(publicVideo({ id: VIDEO_IDS.a }));
      await subject.seedVideo(publicVideo({ id: VIDEO_IDS.b }));
      await subject.seedVideo(publicVideo({ id: VIDEO_IDS.c, ownerId: OTHER_OWNER_ID }));
      await subject.seedVideo(publicVideo({ id: VIDEO_IDS.d }));
      experiments = subject.repositories.videoExperiments;
    });

    it('lists the tests of a video newest first, each read back whole', async () => {
      await create(experiment(1));
      await end(VIDEO_IDS.a, 1);
      await create(experiment(2));
      await create(experiment(3, { videoId: VIDEO_IDS.b }));

      expect(expectOk(await experiments.listFor(VIDEO_IDS.a))).toEqual([
        experiment(2),
        experiment(1, { status: 'stopped', endedAt: ENDED_AT }),
      ]);
      expect(expectOk(await experiments.find(VIDEO_IDS.a, experimentId(2)))).toEqual(experiment(2));
      expect(expectOk(await experiments.find(VIDEO_IDS.b, experimentId(2)))).toBeNull();
    });

    it('answers the running test of each asked video in one read, ended ones left out', async () => {
      await create(experiment(1));
      await end(VIDEO_IDS.a, 1);
      await create(experiment(2, { videoId: VIDEO_IDS.b }));

      expect(
        expectOk(await experiments.runningFor([VIDEO_IDS.a, VIDEO_IDS.b, VIDEO_IDS.c]))
      ).toEqual(new Map([[VIDEO_IDS.b, experiment(2, { videoId: VIDEO_IDS.b })]]));
      expect(expectOk(await experiments.runningFor([]))).toEqual(new Map());
    });

    it('refuses a second running test on one video, and allows one after it ends', async () => {
      expect(await create(experiment(1))).toBe('created');
      expect(await create(experiment(2))).toBe('video-busy');

      await end(VIDEO_IDS.a, 1);

      expect(await create(experiment(3))).toBe('created');
    });

    it('refuses a test once the owner runs the limit over all their videos, counting nobody else', async () => {
      expect(await create(experiment(1), OWNER_ID, 2)).toBe('created');
      expect(await create(experiment(2, { videoId: VIDEO_IDS.b }), OWNER_ID, 2)).toBe('created');

      expect(await create(experiment(3, { videoId: VIDEO_IDS.d }), OWNER_ID, 2)).toBe(
        'channel-full'
      );
      expect(await create(experiment(4, { videoId: VIDEO_IDS.c }), OTHER_OWNER_ID, 2)).toBe(
        'created'
      );
      expect(expectOk(await experiments.runningOnChannel(OWNER_ID))).toBe(2);

      await end(VIDEO_IDS.b, 2);

      expect(expectOk(await experiments.runningOnChannel(OWNER_ID))).toBe(1);
      expect(await create(experiment(5, { videoId: VIDEO_IDS.d }), OWNER_ID, 2)).toBe('created');
    });

    it('ends a running test of its own video once, with the winner and the time', async () => {
      await create(experiment(1));

      expect(await end(VIDEO_IDS.b, 1, 'b')).toBeNull();
      expect(await end(VIDEO_IDS.a, 9)).toBeNull();
      expect(await end(VIDEO_IDS.a, 1, 'b')).toEqual(
        experiment(1, { status: 'finished', winnerVariantId: 'b', endedAt: ENDED_AT })
      );
      expect(await end(VIDEO_IDS.a, 1)).toBeNull();
      expect(expectOk(await experiments.find(VIDEO_IDS.a, experimentId(1)))).toMatchObject({
        status: 'finished',
        winnerVariantId: 'b',
      });
    });

    it('gives every test an empty stats entry until a flush adds numbers to it', async () => {
      await create(experiment(1));

      expect(expectOk(await experiments.statsFor([experimentId(1), experimentId(2)]))).toEqual(
        new Map([
          [experimentId(1), []],
          [experimentId(2), []],
        ])
      );
      expect(expectOk(await experiments.statsFor([]))).toEqual(new Map());
    });
  });
}
