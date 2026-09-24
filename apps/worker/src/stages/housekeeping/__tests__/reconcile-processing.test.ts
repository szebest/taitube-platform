import { type InMemoryJobQueue, InMemoryRepositories } from '@vp/adapters/in-memory';
import { queueUnavailable } from '@vp/errors';
import { ids } from '@vp/job-contracts';
import { err } from '@vp/result';
import { expectOk } from '@vp/testing/result';
import { uuidv7 } from 'uuidv7';
import { runReconcileProcessing } from '../reconcile-processing';
import { HOUR_MS, hoursAgo, inMemoryQueues, seedVideo } from './housekeeping-harness';

describe('housekeeping: reconcile-processing', () => {
  let repositories: InMemoryRepositories;
  let getQueue: (name: string) => InMemoryJobQueue;

  const reconcile = async () =>
    expectOk(
      await runReconcileProcessing({
        repositories,
        getQueue,
        workerId: 'worker-spec',
        thresholdMs: 3 * HOUR_MS,
        scanLimit: 100,
      })
    );

  const seedStaleProcessing = async () =>
    (await seedVideo(repositories, { status: 'PROCESSING', generation: 1, idleSince: hoursAgo(4) }))
      .id;

  beforeEach(() => {
    repositories = new InMemoryRepositories();
    getQueue = inMemoryQueues();
  });

  it('fails an orphaned PROCESSING video as ORPHANED and parks it in the DLQ', async () => {
    const videoId = await seedStaleProcessing();
    const lockToken = uuidv7();
    await repositories.steps.claim({
      id: uuidv7(),
      videoId,
      step: 'probe',
      rendition: '-',
      jobId: ids.probe(videoId, 1),
      attempt: 1,
      workerId: 'worker-1',
      lockToken,
    });
    await repositories.steps.complete({ videoId, step: 'probe', rendition: '-', lockToken });

    expect((await reconcile()).orphanedCount).toBe(1);

    const video = expectOk(await repositories.videos.findById(videoId));
    expect(video?.status).toBe('FAILED');
    expect(video?.errorCode).toBe('ORPHANED');
    expect(expectOk(await repositories.dlq.list({ limit: 100 }))).toEqual([
      expect.objectContaining({
        videoId,
        errorCode: 'ORPHANED',
        status: 'PARKED',
        queue: 'housekeeping',
      }),
    ]);
  });

  it.each([
    {
      scenario: 'a step is still RUNNING',
      arrange: async (videoId: string) => {
        await repositories.steps.claim({
          id: uuidv7(),
          videoId,
          step: 'transcode',
          rendition: '720p',
          jobId: ids.transcode(videoId, '720p', 1),
          attempt: 1,
          workerId: 'worker-active',
          lockToken: uuidv7(),
        });
      },
    },
    {
      scenario: 'a job is waiting in a processing queue',
      arrange: async (videoId: string) => {
        await getQueue('transcode-720p').add('transcode', { videoId, rendition: '720p' });
      },
    },
    {
      scenario: 'a job is in prioritized state',
      arrange: async (videoId: string) => {
        await getQueue('probe').add('probe', { videoId }, { priority: 5 });
      },
    },
    {
      scenario: 'a processing queue cannot be inspected',
      arrange: async () => {
        vi.spyOn(getQueue('probe'), 'getJobs').mockResolvedValue(
          err(queueUnavailable('getJobs', 'redis down'))
        );
      },
    },
  ])('keeps the video PROCESSING when $scenario', async ({ arrange }) => {
    const videoId = await seedStaleProcessing();
    await arrange(videoId);

    expect((await reconcile()).orphanedCount).toBe(0);
    expect(expectOk(await repositories.videos.findById(videoId))?.status).toBe('PROCESSING');
  });
});
