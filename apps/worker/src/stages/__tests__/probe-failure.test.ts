import { InMemoryJobQueue, InMemoryRepositories } from '@vp/adapters';
import type { QueueJob } from '@vp/core/ports';
import type { ProbeJob } from '@vp/job-contracts';
import { expectOk } from '@vp/testing/result';
import { uuidv7 } from 'uuidv7';
import { recordProbeFailure } from '../probe-failure';

const OWNER_ID = '00000000-0000-7000-8000-0000000000a1';

describe('apps/worker: recordProbeFailure', () => {
  let repositories: InMemoryRepositories;
  let notifyQueue: InMemoryJobQueue;
  let videoId: string;
  let lockToken: string;

  const getQueue = () => notifyQueue;

  const job = (): QueueJob<ProbeJob> =>
    ({
      id: `${videoId}--probe--g1`,
      data: { videoId, sourceKey: `raw/${videoId}/source.mp4`, generation: 1, traceparent: 'tp' },
      attemptsMade: 0,
    }) as unknown as QueueJob<ProbeJob>;

  beforeEach(async () => {
    repositories = new InMemoryRepositories();
    notifyQueue = new InMemoryJobQueue('notify');
    videoId = uuidv7();
    lockToken = uuidv7();

    expectOk(
      await repositories.videos.create({
        id: videoId,
        ownerId: OWNER_ID,
        sourceKey: `raw/${videoId}/source.mp4`,
        status: 'PROBING',
      })
    );
    await repositories.steps.claim({
      id: uuidv7(),
      videoId,
      step: 'probe',
      rendition: '-',
      jobId: `${videoId}--probe--g1`,
      attempt: 1,
      workerId: 'worker-1',
      lockToken,
    });
  });

  it('marks the video FAILED and records the code and message on it', async () => {
    await recordProbeFailure(
      { repositories, job: job(), lockToken, getQueue },
      'CORRUPT_CONTAINER',
      'moov atom not found'
    );

    expect(expectOk(await repositories.videos.findById(videoId))).toMatchObject({
      status: 'FAILED',
      errorCode: 'CORRUPT_CONTAINER',
      errorMessage: 'moov atom not found',
    });
  });

  it('marks the processing step failed under the same lock token', async () => {
    await recordProbeFailure(
      { repositories, job: job(), lockToken, getQueue },
      'SOURCE_MISSING',
      'gone'
    );

    const steps = await repositories.steps.findByVideoId(videoId);
    expect(expectOk(steps).find((step) => step.step === 'probe')).toMatchObject({
      status: 'FAILED',
    });
  });

  it('records the failure as a video event, so the audit trail has it', async () => {
    await recordProbeFailure(
      { repositories, job: job(), lockToken, getQueue },
      'SOURCE_MISSING',
      'gone'
    );

    const events = await repositories.events.findByVideoId(videoId);
    expect(expectOk(events).some((event) => event.type === 'video.failed')).toBe(true);
  });

  it('tells the owner, so a failed probe does not go unnoticed', async () => {
    await recordProbeFailure(
      { repositories, job: job(), lockToken, getQueue },
      'UNSUPPORTED_CODEC',
      'prores'
    );

    expect(notifyQueue.enqueuedJobs).toHaveLength(1);
    expect(notifyQueue.enqueuedJobs[0]?.data).toMatchObject({
      videoId,
      userId: OWNER_ID,
      event: 'video.failed',
      payload: { status: 'FAILED', errorCode: 'UNSUPPORTED_CODEC' },
    });
  });

  it('still records the failure when no queue is wired, which is how the tests run it', async () => {
    await recordProbeFailure({ repositories, job: job(), lockToken }, 'SOURCE_MISSING', 'gone');

    expect(expectOk(await repositories.videos.findById(videoId))).toMatchObject({
      status: 'FAILED',
    });
  });

  it('does not notify twice when the video was already failed, because the CAS loses', async () => {
    await recordProbeFailure(
      { repositories, job: job(), lockToken, getQueue },
      'SOURCE_MISSING',
      'gone'
    );
    await recordProbeFailure(
      { repositories, job: job(), lockToken, getQueue },
      'SOURCE_MISSING',
      'gone'
    );

    expect(notifyQueue.enqueuedJobs).toHaveLength(1);
  });
});
