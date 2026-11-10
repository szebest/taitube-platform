import { InMemoryFrameClassifier } from '@vp/adapters/in-memory';
import { ErrorCodes, mediaFailure } from '@vp/errors';
import { err } from '@vp/result';
import { masterPlaylistKey } from '@vp/storage';
import { expectOk } from '@vp/testing/result';
import { createPackageProcessor } from '../stages/package';
import { createProbeProcessor } from '../stages/probe';
import {
  BLANK_FRAMES,
  CLASSIFIER_SIZE,
  type Footage,
  framesOf,
  toolsFor,
} from '../stages/screen/__tests__/screen-harness';
import { createScreenProcessor } from '../stages/screen/screen-stage';
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
} from './flow-harness';
import { throughRunner } from './queue-boundary';
import { STAGE_SETTINGS, transcodeDeps } from './stage-settings';

const S15 = probed(
  { width: 1920, height: 1080, durationMs: 15_000 },
  rungs('1080p', '720p', '480p')
);

describe('screen stage as a flow child of package', () => {
  let world: FlowWorld;

  beforeEach(() => {
    world = flowWorld();
  });

  async function runFlow(
    footage: Footage,
    options: { enabled?: boolean; classifier?: InMemoryFrameClassifier } = {}
  ) {
    const {
      enabled = true,
      classifier = new InMemoryFrameClassifier({ inputSize: CLASSIFIER_SIZE }),
    } = options;
    const media = fakeMedia(S15);
    const videoId = await uploadedVideo(world, 'raw/s15.mp4');
    await createProbeProcessor({
      ...STAGE_SETTINGS,
      ...world,
      media,
      screening: { enabled },
    })({
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
    const thumbnail = createThumbnailProcessor({ ...STAGE_SETTINGS, ...world, media });
    const screen = throughRunner(
      createScreenProcessor({
        ...STAGE_SETTINGS,
        ...world,
        fingerprint: toolsFor(footage),
        classifier,
      })
    );
    await Promise.all([
      ...['1080p', '720p', '480p'].map((rung) =>
        world.getQueue(`transcode-${rung}`).process(transcode)
      ),
      world.getQueue('thumbnail').process(thumbnail),
      world
        .getQueue('screen')
        .process(screen)
        .catch(() => {}),
    ]);
    await packaged;
    return videoId;
  }

  const videoOf = async (videoId: string) =>
    expectOk(await world.repositories.videos.findById(videoId));
  const masterOf = async (videoId: string) =>
    expectOk(
      await world.storage.headObject(STAGE_SETTINGS.publicBucket, masterPlaylistKey(videoId))
    );

  it('screens beside the transcodes and publishes a clean video', async () => {
    const videoId = await runFlow({ frames: framesOf(1, 15) });

    expect(await videoOf(videoId)).toMatchObject({ status: 'READY' });
    expect(await masterOf(videoId)).not.toBeNull();
    expect(expectOk(await world.repositories.screenings.latestForVideo(videoId))).toMatchObject({
      outcome: 'PASS',
    });
  });

  it('holds a blank video before any master is written, and leaves its renditions in place', async () => {
    const videoId = await runFlow({ frames: BLANK_FRAMES });

    expect(await videoOf(videoId)).toMatchObject({ status: 'HELD', masterPlaylistKey: null });
    expect(await masterOf(videoId)).toBeNull();
    const steps = expectOk(await world.repositories.steps.findByVideoId(videoId));
    expect(steps.some((step) => step.step === 'package')).toBe(false);
    const events = expectOk(await world.repositories.events.findByVideoId(videoId));
    expect(events.map((event) => event.type)).toContain('video.held');
  });

  it('holds with SCREEN_ERROR, and never publishes, when the screen job fails for good', async () => {
    const broken = new InMemoryFrameClassifier({ inputSize: CLASSIFIER_SIZE });
    broken.classify = async () =>
      err(mediaFailure('screen', ErrorCodes.SCREEN_MODEL_INVALID, 'damaged'));

    const videoId = await runFlow({ frames: framesOf(2, 15) }, { classifier: broken });

    expect(await videoOf(videoId)).toMatchObject({ status: 'HELD' });
    expect(await masterOf(videoId)).toBeNull();
    const stored = expectOk(await world.repositories.screenings.latestForVideo(videoId));
    expect(stored?.reasons.map((finding) => finding.reason)).toEqual(['SCREEN_ERROR']);
  });

  it('publishes as before, with no screen job, when screening is off', async () => {
    const videoId = await runFlow({ frames: BLANK_FRAMES }, { enabled: false });

    expect(await videoOf(videoId)).toMatchObject({ status: 'READY' });
    expect(world.getQueue('screen').enqueuedJobs).toEqual([]);
  });
});
