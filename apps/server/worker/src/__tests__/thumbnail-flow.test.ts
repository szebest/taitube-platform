import type { MediaTools } from '@vp/ffmpeg';
import { expectOk } from '@vp/testing/result';
import { createPackageProcessor } from '../stages/package';
import { createProbeProcessor } from '../stages/probe';
import { createThumbnailProcessor } from '../stages/thumbnail';
import { createTranscodeProcessor } from '../stages/transcode';
import {
  type FlowWorld,
  completionOf,
  fakeMedia,
  flowWorld,
  probed,
  rungs,
  uploadedVideo,
  writeThumbnails,
} from './flow-harness';
import { throughRunner } from './queue-boundary';
import { STAGE_SETTINGS, failingThumbnails, transcodeDeps } from './stage-settings';

const S15 = probed(
  { width: 1920, height: 1080, durationMs: 15_000 },
  rungs('1080p', '720p', '480p')
);

/** Transcodes that cannot finish until the thumbnail encode has started. */
function transcodesAwaitingThumbnail(): MediaTools {
  const { promise: thumbnailStarted, resolve: startThumbnail } = Promise.withResolvers<void>();
  const media = fakeMedia(S15);
  return {
    ...media,
    transcode: async (options) => {
      await thumbnailStarted;
      return media.transcode(options);
    },
    thumbnail: (options) => {
      startThumbnail();
      return writeThumbnails(options);
    },
  };
}

async function runFlow(world: FlowWorld, media: MediaTools, thumbnails: MediaTools) {
  const videoId = await uploadedVideo(world, 'raw/s15.mp4');
  await createProbeProcessor({ ...STAGE_SETTINGS, ...world, media })({
    id: `${videoId}--probe--g1`,
    name: 'probe',
    data: { videoId, sourceKey: 'raw/s15.mp4', generation: 1, traceparent: '00-01' },
    attemptsMade: 0,
  });
  const packageQueue = world.getQueue('package');
  const packaged = completionOf(packageQueue, `${videoId}--package--g1`);
  await packageQueue.process(
    throughRunner(createPackageProcessor({ ...STAGE_SETTINGS, ...world }))
  );

  const transcode = throughRunner(createTranscodeProcessor(transcodeDeps({ ...world, media })));
  const thumbnail = createThumbnailProcessor({ ...STAGE_SETTINGS, ...world, media: thumbnails });
  await Promise.all([
    ...['1080p', '720p', '480p'].map((rung) =>
      world.getQueue(`transcode-${rung}`).process(transcode)
    ),
    world
      .getQueue('thumbnail')
      .process(thumbnail)
      .catch(() => {}),
  ]);
  await packaged;
  return videoId;
}

describe('thumbnail stage as a non-blocking flow child', () => {
  let world: FlowWorld;

  beforeEach(() => {
    world = flowWorld();
  });

  it('runs the thumbnail child concurrently with the transcodes and reaches READY', async () => {
    const media = transcodesAwaitingThumbnail();
    const videoId = await runFlow(world, media, media);

    expect(expectOk(await world.repositories.videos.findById(videoId))).toMatchObject({
      status: 'READY',
      posterKey: `videos/${videoId}/thumbs/poster.jpg`,
      spriteKey: `videos/${videoId}/thumbs/sprite.jpg`,
    });
  });

  it('still packages the video when the thumbnail encode fails, leaving it without a poster', async () => {
    const videoId = await runFlow(world, fakeMedia(S15), failingThumbnails);

    expect(expectOk(await world.repositories.videos.findById(videoId))).toMatchObject({
      status: 'READY',
      posterKey: null,
      spriteKey: null,
    });
    const steps = expectOk(await world.repositories.steps.findByVideoId(videoId));
    expect(steps.find((s) => s.step === 'thumbnail')).toMatchObject({
      status: 'FAILED',
      errorCode: 'FFMPEG_FAILED',
    });
    const renditions = expectOk(await world.repositories.renditions.findByVideoId(videoId));
    expect(renditions).toHaveLength(3);
    expect(renditions.every((r) => r.status === 'DONE')).toBe(true);
  });
});
