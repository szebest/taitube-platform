import { fakeMedia, flowWorld, probed, rungs, uploadedVideo } from '../../__tests__/flow-harness';
import { STAGE_SETTINGS } from '../../__tests__/stage-settings';
import { createProbeProcessor } from '../probe';

describe('apps/worker/stages: probe follow-up enqueue', () => {
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
});
