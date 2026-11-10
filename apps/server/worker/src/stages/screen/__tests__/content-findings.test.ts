import { InMemoryFrameClassifier, InMemoryStorageClient } from '@vp/adapters/in-memory';
import { ErrorCodes, mediaFailure } from '@vp/errors';
import { err } from '@vp/result';
import { expectErr, expectOk } from '@vp/testing/result';
import { STAGE_SETTINGS } from '../../../__tests__/stage-settings';
import { contentFindings } from '../content-findings';
import { CLASSIFIER_SIZE, toolsFor } from './screen-harness';

const input = {
  videoId: 'v1',
  sourcePath: '/tmp/in.mp4',
  durationMs: 35_000,
  signal: new AbortController().signal,
};

describe('contentFindings', () => {
  let storage: InMemoryStorageClient;

  beforeEach(() => {
    storage = new InMemoryStorageClient();
  });

  const run = (
    brightness: number,
    classifier = new InMemoryFrameClassifier({ inputSize: CLASSIFIER_SIZE })
  ) => {
    const tools = toolsFor({ frames: [], brightness });
    const sampled = vi.spyOn(tools, 'sampleClassifierFrames');
    return {
      sampled,
      tools,
      found: contentFindings(
        {
          storage,
          classifier,
          fingerprint: tools,
          rawBucket: 'raw',
          ffmpegPath: 'ffmpeg',
          limits: STAGE_SETTINGS.ffmpegProcess,
          screening: STAGE_SETTINGS.screening,
        },
        input
      ),
    };
  };

  it('asks for a frame every few seconds plus the first, middle and last, at the model size', async () => {
    const { sampled, found } = run(0);

    expectOk(await found);

    expect(sampled).toHaveBeenCalledWith(
      expect.objectContaining({
        timestampsSeconds: [0, 10, 17.5, 20, 30, 34.5],
        size: CLASSIFIER_SIZE,
      })
    );
  });

  it('finds nothing in neutral frames and stores no evidence', async () => {
    expect(expectOk(await run(0).found)).toEqual([]);
    expect(
      expectOk(await storage.listObjects({ bucket: 'raw', prefix: 'evidence/' })).keys
    ).toEqual([]);
  });

  it('keeps flagged frames as evidence and names their keys in the finding', async () => {
    const [finding] = expectOk(await run(255).found);

    expect(finding).toMatchObject({ reason: 'NSFW', score: 1, evidence: { share: 1 } });
    expect(finding?.evidence.frames).toHaveLength(STAGE_SETTINGS.screening.process.evidenceFrames);
    expect(expectOk(await storage.headObject('raw', 'evidence/v1/frame-0.jpg'))).toMatchObject({
      contentType: 'image/jpeg',
    });
  });

  it('fails with what the classifier says when the model cannot score', async () => {
    const classifier = new InMemoryFrameClassifier({ inputSize: CLASSIFIER_SIZE });
    classifier.classify = async () =>
      err(mediaFailure('screen', ErrorCodes.SCREEN_MODEL_FAILED, 'oom'));

    expect(expectErr(await run(255, classifier).found).code).toBe(ErrorCodes.SCREEN_MODEL_FAILED);
  });
});
