import type { QueueJob } from '@vp/core/ports';
import { ErrorCodes, mediaFailure } from '@vp/errors';
import type { ProbeJob } from '@vp/job-contracts';
import { err } from '@vp/result';
import { captionsTmpPrefix } from '@vp/storage';
import { createMockJob } from '@vp/testing';
import { expectOk } from '@vp/testing/result';
import { createFailureHandler } from '../failure-handler';
import { STAGE_REGISTRY } from '../registry';
import { CUE_EVERY_MS, captionsWorld } from '../stages/captions/__tests__/captions-harness';
import { createPackageProcessor } from '../stages/package';
import { createProbeProcessor } from '../stages/probe';
import { createThumbnailProcessor } from '../stages/thumbnail';
import { completionOf, fakeMedia, flowWorld, probed, rungs, uploadedVideo } from './flow-harness';
import { throughRunner } from './queue-boundary';
import { STAGE_SETTINGS, registryDeps } from './stage-settings';

describe('apps/server/worker: captions flow', () => {
  it('transcribes a twelve minute source in parallel windows and merges one gapless track', async () => {
    const world = await captionsWorld({ durationMs: 720_000 });
    const flow = world.run();
    const captions = STAGE_REGISTRY.captions.createProcessor({
      ...registryDeps(world, world.deps.media),
      speech: world.deps.speech,
    });
    const queue = world.getQueue('captions');
    const merged = completionOf(queue, flow.opts.jobId);

    expectOk(await world.flowProducer.add(flow));
    await queue.process(throughRunner(captions));
    await merged;

    const cues = expectOk(await world.repositories.captions.cues(world.track.id));
    expect(cues.map((cue) => cue.startMs)).toEqual(
      Array.from({ length: 720_000 / CUE_EVERY_MS }, (_, n) => n * CUE_EVERY_MS)
    );
    expect(world.spans).toHaveLength(4);
    const left = expectOk(
      await world.storage.listObjects({ bucket: 'raw', prefix: captionsTmpPrefix(world.videoId) })
    );
    expect(left.keys).toEqual([]);
  });

  it('fails only the track when a run fails, leaving the video as it was', async () => {
    const world = await captionsWorld();
    const before = expectOk(await world.repositories.videos.findById(world.videoId));
    const queue = world.getQueue('captions');
    queue.onFailed(
      createFailureHandler({
        stage: 'captions',
        queueName: 'captions',
        repositories: world.repositories,
        getQueue: world.getQueue,
        logger: world.logger,
        metrics: world.deps.metrics,
        workerId: 'captions-spec',
      })
    );
    const captions = STAGE_REGISTRY.captions.createProcessor({
      ...registryDeps(world, world.deps.media),
      speech: {
        transcribe: async () =>
          err(mediaFailure('captions', ErrorCodes.WHISPER_MODEL_INVALID, 'no model')),
      },
    });

    expectOk(await world.flowProducer.add(world.run()));
    await expect(queue.process(throughRunner(captions))).rejects.toMatchObject({
      code: ErrorCodes.WHISPER_MODEL_INVALID,
    });

    expect(expectOk(await world.repositories.captions.findById(world.track.id))).toMatchObject({
      status: 'failed',
      reason: ErrorCodes.WHISPER_MODEL_INVALID,
    });
    const after = expectOk(await world.repositories.videos.findById(world.videoId));
    expect([after?.status, after?.version]).toEqual([before?.status, before?.version]);
  });

  it('reaches READY with the captions queue never served', async () => {
    const world = flowWorld();
    const videoId = await uploadedVideo(world, 'raw/s60.mp4');
    expectOk(await world.repositories.captions.setAutoCaptions(videoId, true));
    const media = fakeMedia(
      probed({ width: 1280, height: 720, durationMs: 60_000 }, rungs('720p'))
    );
    const probeJob: QueueJob<ProbeJob> = createMockJob(
      'probe',
      { videoId, sourceKey: 'raw/s60.mp4', generation: 1, traceparent: '00-01-01-01' },
      { id: `${videoId}--probe--g1` }
    );
    expectOk(await createProbeProcessor({ ...STAGE_SETTINGS, ...world, media })(probeJob));

    const packageQueue = world.getQueue('package');
    const packaged = completionOf(packageQueue, `${videoId}--package--g1`);
    await packageQueue.process(
      throughRunner(createPackageProcessor({ ...STAGE_SETTINGS, ...world }))
    );
    await world
      .getQueue('thumbnail')
      .process(throughRunner(createThumbnailProcessor({ ...STAGE_SETTINGS, ...world, media })));
    const transcode = STAGE_REGISTRY['transcode-720p'].createProcessor(registryDeps(world, media));
    await world.getQueue('transcode-720p').process(throughRunner(transcode));
    await packaged;

    expect(expectOk(await world.repositories.videos.findById(videoId))?.status).toBe('READY');
    expect(expectOk(await world.repositories.captions.findGenerated(videoId))?.status).toBe(
      'pending'
    );
  });
});
