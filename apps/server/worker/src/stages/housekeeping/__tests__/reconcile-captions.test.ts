import { InMemoryRepositories } from '@vp/adapters/in-memory';
import { createMetricsRegistry } from '@vp/observability';
import { expectOk } from '@vp/testing/result';
import { uuidv7 } from 'uuidv7';
import { runReconcileCaptions } from '../reconcile-captions';
import { seedVideo } from './housekeeping-harness';

describe('housekeeping: reconcile-captions', () => {
  let repositories: InMemoryRepositories;

  const reconcile = (enabled = true) =>
    runReconcileCaptions({
      repositories,
      metrics: createMetricsRegistry(),
      captions: { enabled, modelVersion: 'small-q5_1' },
      thresholdMs: -1000,
      scanLimit: 10,
    });

  const pendingTrack = async (fields: Parameters<typeof seedVideo>[1]) => {
    const video = await seedVideo(repositories, fields);
    const track = expectOk(
      await repositories.captions.createGenerated({
        id: uuidv7(),
        videoId: video.id,
        language: null,
        modelVersion: 'small-q5_1',
        status: 'pending',
        reason: null,
      })
    );
    return { video, track };
  };

  beforeEach(() => {
    repositories = new InMemoryRepositories();
  });

  it('enqueues a stuck run again under the job id it had', async () => {
    const { video, track } = await pendingTrack({ status: 'READY', durationMs: 60_000 });

    expect(expectOk(await reconcile())).toEqual({ requeued: 1 });
    const [entry] = expectOk(await repositories.outbox.claimBatch(10));
    expect(entry?.payload).toMatchObject({
      type: 'flow',
      flow: {
        queueName: 'captions',
        opts: { jobId: `${video.id}--captions--small-q5_1--v${track.version}` },
      },
    });
  });

  it.each([
    { name: 'a deleted video', fields: { status: 'DELETED' as const, durationMs: 60_000 } },
    { name: 'a video not probed yet', fields: { status: 'UPLOADED' as const } },
  ])('leaves $name alone', async ({ fields }) => {
    await pendingTrack(fields);

    expect(expectOk(await reconcile())).toEqual({ requeued: 0 });
  });

  it('does nothing while the platform switch is off', async () => {
    await pendingTrack({ status: 'READY', durationMs: 60_000 });

    expect(expectOk(await reconcile(false))).toEqual({ requeued: 0 });
  });
});
