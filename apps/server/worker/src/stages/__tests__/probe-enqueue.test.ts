import { ThumbnailJob, TranscodeJob } from '@vp/job-contracts';
import { ok } from '@vp/result';
import { expectOk } from '@vp/testing/result';
import { fakeMedia, flowWorld, probed, rungs, uploadedVideo } from '../../__tests__/flow-harness';
import { STAGE_SETTINGS } from '../../__tests__/stage-settings';
import { createProbeProcessor } from '../probe';

describe('apps/server/worker/stages: probe follow-up enqueue', () => {
  it('gives every child a deterministic job id and adds none twice when the probe runs again', async () => {
    const world = flowWorld();
    const sourceKey = 'raw/s60.mp4';
    const videoId = await uploadedVideo(world, sourceKey);
    const media = fakeMedia(
      probed({ width: 1920, height: 1080, durationMs: 60_000 }, rungs('1080p', '720p', '480p'))
    );
    const probe = createProbeProcessor({ ...STAGE_SETTINGS, ...world, media });
    const run = (attemptsMade: number) =>
      probe({
        id: `${videoId}--probe--g1`,
        name: 'probe',
        data: { videoId, sourceKey, generation: 1, traceparent: '00-1' },
        attemptsMade,
      });
    const children = {
      'transcode-1080p': `${videoId}--transcode--1080p--g1`,
      'transcode-720p': `${videoId}--transcode--720p--g1`,
      'transcode-480p': `${videoId}--transcode--480p--g1`,
      thumbnail: `${videoId}--thumbnail--g1`,
    };
    const enqueued = () =>
      Object.keys(children).map((queue) => world.getQueue(queue).enqueuedJobs.map((job) => job.id));

    await run(0);
    expect(enqueued()).toEqual(Object.values(children).map((id) => [id]));

    await run(1);
    expect(enqueued()).toEqual(Object.values(children).map((id) => [id]));
  });

  it('gives the thumbnail the video stream duration and the transcodes the container duration', async () => {
    const world = flowWorld();
    const sourceKey = 'raw/audio-longer.mp4';
    const videoId = await uploadedVideo(world, sourceKey);
    const media = fakeMedia(
      probed(
        { width: 1280, height: 720, durationMs: 11_000, videoDurationMs: 10_000 },
        rungs('720p')
      )
    );
    const probe = createProbeProcessor({ ...STAGE_SETTINGS, ...world, media });

    await probe({
      id: `${videoId}--probe--g1`,
      name: 'probe',
      data: { videoId, sourceKey, generation: 1, traceparent: '00-1' },
      attemptsMade: 0,
    });

    const [thumbnail] = world.getQueue('thumbnail').enqueuedJobs;
    const [transcode] = world.getQueue('transcode-720p').enqueuedJobs;
    expect(ThumbnailJob.parse(thumbnail?.data).durationMs).toBe(10_000);
    expect(TranscodeJob.parse(transcode?.data).durationMs).toBe(11_000);
  });

  it('fans a source over five minutes out into chunk jobs under one concat job per rendition', async () => {
    const world = flowWorld();
    const sourceKey = 'raw/s360.mp4';
    const videoId = await uploadedVideo(world, sourceKey);
    const media = fakeMedia(
      probed({ width: 1280, height: 720, durationMs: 360_000 }, rungs('720p', '480p'))
    );
    const probe = createProbeProcessor({ ...STAGE_SETTINGS, ...world, media });

    await probe({
      id: `${videoId}--probe--g1`,
      name: 'probe',
      data: { videoId, sourceKey, generation: 1, traceparent: '00-1' },
      attemptsMade: 0,
    });

    const queue = world.getQueue('transcode-720p');
    const chunks = queue.enqueuedJobs.map((job) => ({
      id: job.id,
      data: TranscodeJob.parse(job.data),
    }));
    const concatId = `${videoId}--transcode--720p--g1`;
    expect(await queue.getJobState(concatId)).toEqual(ok('waiting-children'));
    expect(chunks.map((job) => job.data.chunkCount)).toEqual(Array(12).fill(12));
    expect(chunks.map((job) => job.id)).toEqual(
      Array.from({ length: 12 }, (_, index) => `${videoId}--transcode--720p--c${index}--g1`)
    );
    expect(chunks.map((job) => job.data.chunkIndex)).toEqual(
      Array.from({ length: 12 }, (_, i) => i)
    );
    expect(world.getQueue('transcode-480p').enqueuedJobs).toHaveLength(12);
  });

  describe('captions', () => {
    async function probeWith(autoCaptions: boolean | null, audioCodec?: string) {
      const world = flowWorld();
      const sourceKey = 'raw/captions.mp4';
      const videoId = await uploadedVideo(world, sourceKey);
      expectOk(await world.repositories.captions.setAutoCaptions(videoId, autoCaptions));
      const metadata = {
        ...probed({ width: 1280, height: 720, durationMs: 60_000 }, rungs('720p')),
        audioCodec,
      };
      const probe = createProbeProcessor({
        ...STAGE_SETTINGS,
        ...world,
        media: fakeMedia(metadata),
      });
      expectOk(
        await probe({
          id: `${videoId}--probe--g1`,
          name: 'probe',
          data: { videoId, sourceKey, generation: 1, traceparent: '00-1' },
          attemptsMade: 0,
        })
      );
      const outbox = expectOk(await world.repositories.outbox.claimBatch(50));
      return {
        flows: outbox.filter((item) => item.kind === 'captions').map((item) => item.payload),
        followUps: ['transcode-720p', 'thumbnail'].map((queue) =>
          world.getQueue(queue).enqueuedJobs.map((job) => job.id.replace(videoId, 'v'))
        ),
        track: expectOk(await world.repositories.captions.findGenerated(videoId)),
        videoId,
      };
    }

    it.each([
      { autoCaptions: true, runs: 1 },
      { autoCaptions: false, runs: 0 },
      { autoCaptions: null, runs: 0 },
    ])(
      'starts $runs captions run for a video set to $autoCaptions on an opted-out channel',
      async ({ autoCaptions, runs }) => {
        const { flows, track } = await probeWith(autoCaptions, 'aac');

        expect(flows).toHaveLength(runs);
        expect(track?.status).toBe(runs === 1 ? 'pending' : undefined);
      }
    );

    it('adds the run on the captions queue alone, beside the same package flow', async () => {
      const on = await probeWith(true, 'aac');
      const off = await probeWith(false, 'aac');

      expect(on.followUps).toEqual(off.followUps);
      expect(on.flows[0]).toMatchObject({
        type: 'flow',
        flow: { queueName: 'captions', data: { videoId: on.videoId, plan: { type: 'single' } } },
      });
    });

    it('gives a source with no audio a disabled track and no run', async () => {
      const { flows, track } = await probeWith(true);

      expect(flows).toEqual([]);
      expect(track).toMatchObject({ status: 'disabled', reason: 'NO_AUDIO' });
    });
  });
});
