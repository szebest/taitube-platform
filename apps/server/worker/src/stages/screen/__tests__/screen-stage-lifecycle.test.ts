import { InMemoryFrameClassifier } from '@vp/adapters/in-memory';
import { ErrorCodes, mediaFailure } from '@vp/errors';
import { err } from '@vp/result';
import { SEEDED } from '@vp/testing';
import { expectErr, expectOk } from '@vp/testing/result';
import { uuidv7 } from 'uuidv7';
import { STAGE_SETTINGS } from '../../../__tests__/stage-settings';
import {
  BLANK_FRAMES,
  CLASSIFIER_SIZE,
  type ScreenWorld,
  framesOf,
  screenWorld,
  toolsFor,
} from './screen-harness';

const { thresholds } = STAGE_SETTINGS.screening;

describe('screen stage: re-runs, fencing and failures', () => {
  let repositories: ScreenWorld['repositories'];
  let storage: ScreenWorld['storage'];
  let video: ScreenWorld['video'];
  let job: ScreenWorld['job'];
  let processor: ScreenWorld['processor'];
  let screen: ScreenWorld['screen'];
  let stored: ScreenWorld['stored'];

  beforeEach(() => {
    ({ repositories, storage, video, job, processor, screen, stored } = screenWorld());
  });

  async function earlierResult(videoId: string, sourceKey: string, sourceChecksum?: string) {
    const head = expectOk(await storage.headObject('raw', sourceKey));
    return expectOk(
      await repositories.screenings.record({
        id: uuidv7(),
        videoId,
        sourceChecksum: sourceChecksum ?? (head?.etag ?? '').replaceAll('"', ''),
        outcome: 'HOLD',
        score: 1,
        reasons: [{ reason: 'BLANK', score: 1, evidence: {} }],
        flags: [],
        modelVersion: null,
        thresholdVersion: thresholds.version,
      })
    );
  }

  it('gives the stored result back for the same source, running none of the tools', async () => {
    const { videoId, sourceKey } = await video();
    const earlier = await earlierResult(videoId, sourceKey);
    const rerun = toolsFor({ frames: framesOf(99, 15) });

    const again = expectOk(await processor(rerun)(job(videoId, sourceKey)));

    expect(again).toMatchObject({ screeningId: earlier.id, outcome: 'HOLD', reasons: ['BLANK'] });
    expect(rerun.calls).toEqual([]);
  });

  it('screens again when the stored result is for another source checksum', async () => {
    const { videoId, sourceKey } = await video();
    await earlierResult(videoId, sourceKey, 'a-source-that-is-gone');
    const rerun = toolsFor({ frames: framesOf(98, 15) });

    const again = expectOk(await processor(rerun)(job(videoId, sourceKey)));

    expect(again).toMatchObject({ outcome: 'PASS', reasons: [] });
    expect(rerun.calls).toContain('sampleFrames');
  });

  it('does not hold a video a moderator approved, when it is processed again', async () => {
    const first = await screen({ frames: BLANK_FRAMES });
    expectOk(await repositories.screenings.hold({ videoId: first.videoId }));
    expectOk(
      await repositories.screenings.approve({
        videoId: first.videoId,
        moderatorId: SEEDED.userId,
      })
    );

    const again = expectOk(
      await processor(toolsFor({ frames: BLANK_FRAMES }))(job(first.videoId, first.sourceKey))
    );

    expect(again).toMatchObject({ outcome: 'PASS', reasons: [] });
  });

  it('answers with the stored result when its step is already complete', async () => {
    const first = await screen({ frames: framesOf(13, 15) });
    const rerun = toolsFor({ frames: BLANK_FRAMES });

    const again = await processor(rerun)({ ...job(first.videoId, first.sourceKey), id: 'a-retry' });

    expect(expectOk(again)).toEqual(expectOk(first.result));
    expect(rerun.calls).toEqual([]);
  });

  it('commits nothing when another worker took the step while it ran', async () => {
    const { videoId, sourceKey } = await video();
    const thief = uuidv7();
    const tools = toolsFor({ frames: framesOf(14, 15) });
    const stolen = {
      ...tools,
      sampleFrames: async (...args: Parameters<typeof tools.sampleFrames>) => {
        await repositories.steps.claim({
          id: uuidv7(),
          videoId,
          step: 'screen',
          rendition: '-',
          jobId: 'other',
          attempt: 2,
          workerId: 'other',
          lockToken: thief,
        });
        return tools.sampleFrames(...args);
      },
    };

    expectOk(await processor(stolen)(job(videoId, sourceKey)));

    const steps = expectOk(await repositories.steps.findByVideoId(videoId));
    expect(steps).toMatchObject([{ status: 'RUNNING', lockToken: thief }]);
  });

  it('fails permanently, with no result stored, when the model is not the pinned one', async () => {
    const broken = new InMemoryFrameClassifier({ inputSize: CLASSIFIER_SIZE });
    broken.classify = async () =>
      err(mediaFailure('screen', ErrorCodes.SCREEN_MODEL_INVALID, 'wrong checksum'));
    const { videoId, sourceKey } = await video();

    const failure = expectErr(
      await processor(toolsFor({ frames: framesOf(15, 15) }), broken)(job(videoId, sourceKey))
    );

    expect(failure.code).toBe(ErrorCodes.SCREEN_MODEL_INVALID);
    expect(await stored(videoId)).toBeNull();
    expect(expectOk(await repositories.steps.findByVideoId(videoId))).toMatchObject([
      { status: 'FAILED', errorCode: ErrorCodes.SCREEN_MODEL_INVALID },
    ]);
  });

  it('fails with SOURCE_MISSING when the raw object is gone', async () => {
    const { videoId } = await video();

    const failure = expectErr(
      await processor(toolsFor({ frames: [] }))(job(videoId, 'raw/missing.mp4'))
    );

    expect(failure.code).toBe(ErrorCodes.SOURCE_MISSING);
  });
});
