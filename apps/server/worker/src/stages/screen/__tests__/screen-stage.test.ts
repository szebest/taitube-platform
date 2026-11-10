import { InMemoryFrameClassifier } from '@vp/adapters/in-memory';
import { expectOk } from '@vp/testing/result';
import { STAGE_SETTINGS } from '../../../__tests__/stage-settings';
import {
  BLANK_FRAMES,
  CLASSIFIER_SIZE,
  OTHER_OWNER,
  type ScreenWorld,
  framesOf,
  screenWorld,
  toolsFor,
} from './screen-harness';

const { thresholds } = STAGE_SETTINGS.screening;

describe('screen stage', () => {
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

  it('passes a clean video, stores the result by the source checksum and completes the step', async () => {
    const { videoId, result } = await screen({ frames: framesOf(1, 15) });

    expect(expectOk(result)).toMatchObject({ type: 'screen', outcome: 'PASS', reasons: [] });
    expect(await stored(videoId)).toMatchObject({
      outcome: 'PASS',
      modelVersion: 'in-memory',
      thresholdVersion: thresholds.version,
    });
    const steps = expectOk(await repositories.steps.findByVideoId(videoId));
    expect(steps).toMatchObject([{ step: 'screen', status: 'DONE' }]);
  });

  it('holds a re-upload by another channel as DUPLICATE, naming the first video as evidence', async () => {
    const first = await screen({ frames: framesOf(2, 15) }, { ownerId: OTHER_OWNER });

    const second = await screen({ frames: framesOf(2, 15) });

    expect(expectOk(second.result)).toMatchObject({ outcome: 'HOLD', reasons: ['DUPLICATE'] });
    expect((await stored(second.videoId))?.reasons[0]).toMatchObject({
      reason: 'DUPLICATE',
      score: 1,
      evidence: { matchedVideoId: first.videoId, sameChannel: false },
    });
  });

  it('flags a same-channel re-upload without holding it', async () => {
    await screen({ frames: framesOf(3, 15) });

    const again = await screen({ frames: framesOf(3, 15) });

    expect(expectOk(again.result)).toMatchObject({ outcome: 'PASS', reasons: [] });
    expect((await stored(again.videoId))?.flags[0]).toMatchObject({
      reason: 'DUPLICATE',
      evidence: { sameChannel: true },
    });
  });

  it('holds a copy of a rejected video as KNOWN_REJECTED, whoever uploaded it', async () => {
    await screen({ frames: framesOf(4, 15) }, { ownerId: OTHER_OWNER, status: 'REJECTED' });

    const copy = await screen({ frames: framesOf(4, 15) });

    expect(expectOk(copy.result)).toMatchObject({ outcome: 'HOLD', reasons: ['KNOWN_REJECTED'] });
  });

  it('flags a copy of part of another video as PARTIAL_MATCH and lets it through', async () => {
    await screen({ frames: framesOf(5, 30) }, { ownerId: OTHER_OWNER });

    const excerpt = await screen({ frames: [...framesOf(5, 12), ...framesOf(6, 18, 100)] });

    expect(expectOk(excerpt.result)).toMatchObject({ outcome: 'PASS', reasons: [] });
    expect((await stored(excerpt.videoId))?.flags[0]).toMatchObject({ reason: 'PARTIAL_MATCH' });
  });

  it('holds a blank video', async () => {
    const { result } = await screen({ frames: BLANK_FRAMES });

    expect(expectOk(result)).toMatchObject({ outcome: 'HOLD', reasons: ['BLANK'] });
  });

  it('holds explicit frames and keeps the strongest as JPEGs under the video evidence prefix', async () => {
    const { videoId, result } = await screen({ frames: framesOf(7, 15), brightness: 255 });

    expect(expectOk(result)).toMatchObject({ outcome: 'HOLD', reasons: ['NSFW'] });
    const { reasons } = (await stored(videoId)) ?? { reasons: [] };
    const frames = reasons[0]?.evidence.frames as { key: string }[];
    expect(frames.length).toBeLessThanOrEqual(STAGE_SETTINGS.screening.process.evidenceFrames);
    expect(frames[0]?.key).toBe(`evidence/${videoId}/frame-0.jpg`);
    expect(
      expectOk(await storage.headObject('raw', `evidence/${videoId}/frame-0.jpg`))
    ).toMatchObject({
      contentType: 'image/jpeg',
    });
  });

  it('flags one odd frame of a long video without holding it', async () => {
    let seen = 0;
    const oneOdd = new InMemoryFrameClassifier({
      inputSize: CLASSIFIER_SIZE,
      score: () => (seen++ === 0 ? 1 : 0),
    });
    const { videoId, sourceKey } = await video();

    const result = await processor(
      toolsFor({ frames: framesOf(8, 15) }),
      oneOdd
    )(job(videoId, sourceKey, false, 300_000));

    expect(expectOk(result)).toMatchObject({ outcome: 'PASS' });
    expect((await stored(videoId))?.flags[0]).toMatchObject({ reason: 'NSFW' });
  });

  it('holds a title that is spam', async () => {
    const { result } = await screen({ frames: framesOf(9, 15) }, { title: 'BUY NOW THIS IS SHIT' });

    expect(expectOk(result)).toMatchObject({ outcome: 'HOLD', reasons: ['METADATA_SPAM'] });
  });

  it.each([
    { hasAudio: true, fpcalc: 1 },
    { hasAudio: false, fpcalc: 0 },
  ])(
    'runs fpcalc $fpcalc times when the probe says audio is $hasAudio',
    async ({ hasAudio, fpcalc }) => {
      const { tools } = await screen({ frames: framesOf(10, 15), terms: [1, 2, 3] }, {}, hasAudio);

      expect(tools.calls.filter((call) => call === 'runFpcalc')).toHaveLength(fpcalc);
    }
  );
});
