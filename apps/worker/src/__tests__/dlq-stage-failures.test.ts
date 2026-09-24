import { ErrorCodes, PermanentError } from '@vp/errors';
import { NotifyJob, stagePolicies } from '@vp/job-contracts';
import { expectOk } from '@vp/testing/result';
import { createFailureHandler } from '../failure-handler';
import { createPackageProcessor } from '../stages/package';
import { createProbeProcessor } from '../stages/probe';
import { createTranscodeProcessor } from '../stages/transcode';
import { type FlowWorld, flowWorld, rungs, uploadedVideo } from './flow-harness';
import { throughRunner } from './queue-boundary';
import { STAGE_SETTINGS, failingTranscodeOf, transcodeDeps } from './stage-settings';

describe('apps/worker: stage failures that end in the DLQ', () => {
  let world: FlowWorld;

  const parkFailuresOf = (queueName: string) =>
    world
      .getQueue(queueName)
      .onFailed(createFailureHandler({ ...STAGE_SETTINGS, ...world, stage: queueName, queueName }));

  beforeEach(() => {
    world = flowWorld();
  });

  it("fails the parent package and the video with the child's code, and publishes video.failed", async () => {
    const sourceKey = 'raw/fail-parent.mp4';
    const videoId = await uploadedVideo(world, sourceKey);
    expectOk(
      await world.repositories.videos.transition({
        videoId,
        from: 'UPLOADED',
        to: 'PROCESSING',
        eventType: 'video.processing',
      })
    );
    parkFailuresOf('package');
    parkFailuresOf('transcode-720p');

    const transcode720 = createTranscodeProcessor(
      transcodeDeps({ ...world, media: failingTranscodeOf('720p') })
    );
    await world.getQueue('transcode-720p').process(throughRunner(transcode720));
    const pkg = createPackageProcessor({ ...STAGE_SETTINGS, ...world });
    await world.getQueue('package').process(throughRunner(pkg));

    const ladder = rungs('720p');
    await world.flowProducer.add({
      name: 'package',
      queueName: 'package',
      data: { videoId, generation: 1, ladder, traceparent: '00-1' },
      opts: { jobId: `${videoId}--package--g1` },
      children: ladder.map((rendition) => ({
        name: 'transcode-720p',
        queueName: 'transcode-720p',
        data: {
          videoId,
          sourceKey,
          generation: 1,
          rendition,
          fps: 24,
          durationMs: 10_000,
          traceparent: '00-1',
        },
        opts: {
          jobId: `${videoId}--transcode--720p--g1`,
          failParentOnFailure: true,
          attempts: 1,
        },
      })),
    });
    await new Promise((resolve) => setTimeout(resolve, 50));

    const video = expectOk(await world.repositories.videos.findById(videoId));
    expect(video?.status).toBe('FAILED');
    expect(video?.errorCode).toBe(ErrorCodes.FFMPEG_FAILED);

    const failedNotice = world
      .getQueue('notify')
      .enqueuedJobs.map((job) => NotifyJob.parse(job.data))
      .find((job) => job.event === 'video.failed');
    expect(failedNotice?.payload).toMatchObject({
      status: 'FAILED',
      errorCode: ErrorCodes.FFMPEG_FAILED,
    });

    expect(expectOk(await world.repositories.dlq.list({ limit: 100 })).length).toBeGreaterThan(0);
    expect(await STAGE_SETTINGS.metrics.registry.metrics()).toContain('dlq_entries_total');
  });

  it.each([
    {
      key: 'raw/audio-only.mp4',
      code: ErrorCodes.CORRUPT_CONTAINER,
      message: 'Source file contains no video stream',
    },
    {
      key: 'raw/bad-codec.mp4',
      code: ErrorCodes.UNSUPPORTED_CODEC,
      message: 'Unsupported video codec "prores"',
    },
    {
      key: 'raw/over-duration.mp4',
      code: ErrorCodes.DURATION_EXCEEDED,
      message: 'Video duration exceeds maximum allowed',
    },
  ])('parks hostile source $key on its first attempt as $code', async ({ key, code, message }) => {
    parkFailuresOf('probe');
    const videoId = await uploadedVideo(world, key);
    const media = {
      ...STAGE_SETTINGS.media,
      probe: () => Promise.reject(new PermanentError(code, message)),
    };
    const probe = createProbeProcessor({ ...STAGE_SETTINGS, ...world, media });
    const jobId = `${videoId}--probe--g1`;
    const data = { videoId, sourceKey: key, generation: 1, traceparent: '00-1' };
    await world.getQueue('probe').add('probe', data, { jobId, ...stagePolicies.probe });

    await expect(world.getQueue('probe').process(throughRunner(probe))).rejects.toThrow(message);

    const entries = expectOk(await world.repositories.dlq.list({ limit: 100 }));
    expect(entries.find((entry) => entry.jobId === jobId)).toMatchObject({
      errorCode: code,
      attemptsMade: 1,
      status: 'PARKED',
    });
    const video = expectOk(await world.repositories.videos.findById(videoId));
    expect(video?.status).toBe('FAILED');
    expect(video?.errorCode).toBe(code);
  });
});
