import { InMemoryRepositories } from '@vp/adapters/in-memory';
import { ids } from '@vp/job-contracts';
import { expectOk } from '@vp/testing/result';
import { uuidv7 } from 'uuidv7';
import { DAY_MS, queueOutboxEntry } from '../stages/housekeeping/__tests__/housekeeping-harness';

describe('outbox writes', () => {
  let repositories: InMemoryRepositories;

  const pending = async () => expectOk(await repositories.outbox.claimBatch(10));

  beforeEach(() => {
    repositories = new InMemoryRepositories();
  });

  it('writes the outbox entry together with the video transition', async () => {
    const videoId = uuidv7();
    await repositories.videos.create({
      id: videoId,
      ownerId: uuidv7(),
      sourceKey: `raw/${videoId}/source.mp4`,
      status: 'PROCESSING',
    });
    const notifyJobId = ids.notify(videoId, 'video.ready', 1);

    const transitioned = await repositories.videos.transition({
      videoId,
      from: 'PROCESSING',
      to: 'READY',
      eventType: 'video.ready',
      outbox: queueOutboxEntry('notify', { videoId, event: 'video.ready' }, notifyJobId),
    });

    expect(expectOk(transitioned)).toBe(true);
    expect(expectOk(await repositories.videos.findById(videoId))?.status).toBe('READY');
    expect(await pending()).toEqual([
      expect.objectContaining({
        kind: 'notify',
        payload: expect.objectContaining({
          type: 'queue',
          job: expect.objectContaining({ opts: { jobId: notifyJobId } }),
        }),
      }),
    ]);
  });

  it('writes the replay job to the outbox together with the DLQ status change', async () => {
    const dlqId = uuidv7();
    await repositories.dlq.create({
      id: dlqId,
      queue: 'probe',
      jobId: 'failed-job-1',
      videoId: uuidv7(),
      payload: { test: true },
      errorCode: 'INTERNAL',
      errorMessage: 'failed',
      attemptsMade: 3,
      status: 'PARKED',
    });

    await repositories.dlq.updateStatus(
      dlqId,
      'REPLAYED',
      { replayedAt: new Date() },
      queueOutboxEntry('probe', { test: true }, 'failed-job-1--replay--1', 'dlq_replay')
    );

    expect(expectOk(await repositories.dlq.findById(dlqId))?.status).toBe('REPLAYED');
    expect((await pending()).map((item) => item.kind)).toContain('dlq_replay');
  });

  it('prunes published entries older than the retention and keeps recent ones', async () => {
    const stale = expectOk(await repositories.outbox.enqueue(queueOutboxEntry('probe')));
    repositories.outbox.seedPublished(stale.id, new Date(Date.now() - 8 * DAY_MS));
    const recent = expectOk(await repositories.outbox.enqueue(queueOutboxEntry('notify')));
    repositories.outbox.seedPublished(recent.id, new Date(Date.now() - DAY_MS));

    expect(expectOk(await repositories.outbox.prune(7))).toBe(1);
    expect(expectOk(await repositories.outbox.findById(stale.id))).toBeNull();
    expect(expectOk(await repositories.outbox.findById(recent.id))).not.toBeNull();
  });
});
