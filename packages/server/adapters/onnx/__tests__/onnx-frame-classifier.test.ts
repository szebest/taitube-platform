import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ScreeningModelTuning } from '@vp/env-schema';
import { ErrorCodes } from '@vp/errors';
import { expectErr, expectOk } from '@vp/testing/result';
import {
  describeFrameClassifierContract,
  solidFrame,
} from '../../__tests__/contract/frame-classifier.contract';
import { OnnxFrameClassifier } from '../onnx-frame-classifier';
import { tinyBrightnessModel } from './tiny-model';

const MODEL = tinyBrightnessModel();
const SIZE = 8;

const tuning = (overrides: Partial<ScreeningModelTuning> = {}): ScreeningModelTuning => ({
  name: 'tiny-brightness',
  sha256: createHash('sha256').update(MODEL).digest('hex'),
  inputSize: SIZE,
  mean: 0,
  std: 1,
  activation: 'none',
  labels: { nsfw: 0 },
  intraOpThreads: 1,
  batchSize: 3,
  ...overrides,
});

describe('OnnxFrameClassifier', () => {
  let dir: string;
  let modelPath: string;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'onnx-classifier-'));
    modelPath = join(dir, 'tiny.onnx');
    writeFileSync(modelPath, MODEL);
  });

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  describeFrameClassifierContract(async () => {
    const classifier = new OnnxFrameClassifier({ modelPath, model: tuning() });
    expectOk(await classifier.start());
    return { classifier, close: () => classifier.close() };
  });

  it('refuses a model whose checksum is not the pinned one, before it opens a session', async () => {
    const classifier = new OnnxFrameClassifier({
      modelPath,
      model: tuning({ sha256: '0'.repeat(64) }),
    });

    const failure = expectErr(await classifier.start());

    expect(failure.code).toBe(ErrorCodes.SCREEN_MODEL_INVALID);
    expect(failure.message).toContain('the lock file pins');
  });

  it('refuses a model file that is not there', async () => {
    const classifier = new OnnxFrameClassifier({
      modelPath: join(dir, 'gone.onnx'),
      model: tuning(),
    });

    expect(expectErr(await classifier.classify([])).code).toBe(ErrorCodes.SCREEN_MODEL_INVALID);
  });

  it('refuses a pinned file that is not an ONNX model', async () => {
    const junk = Buffer.from('not a model');
    const junkPath = join(dir, 'junk.onnx');
    writeFileSync(junkPath, junk);
    const sha256 = createHash('sha256').update(junk).digest('hex');

    const failure = expectErr(
      await new OnnxFrameClassifier({ modelPath: junkPath, model: tuning({ sha256 }) }).start()
    );

    expect(failure.code).toBe(ErrorCodes.SCREEN_MODEL_INVALID);
  });

  it('fails a frame of another size as a model failure, not a throw', async () => {
    const classifier = new OnnxFrameClassifier({ modelPath, model: tuning() });

    const failure = expectErr(await classifier.classify([solidFrame(SIZE + 1, 0)]));

    expect(failure.code).toBe(ErrorCodes.SCREEN_MODEL_FAILED);
    await classifier.close();
  });

  it('fails when a label points past what the model outputs', async () => {
    const classifier = new OnnxFrameClassifier({
      modelPath,
      model: tuning({ labels: { nsfw: 1 } }),
    });

    const failure = expectErr(await classifier.classify([solidFrame(SIZE, 0)]));

    expect(failure.code).toBe(ErrorCodes.SCREEN_MODEL_FAILED);
    await classifier.close();
  });

  it.each([
    { activation: 'none' as const, white: 1 },
    { activation: 'softmax' as const, white: 1 },
  ])('reads a $activation output', async ({ activation, white }) => {
    const classifier = new OnnxFrameClassifier({ modelPath, model: tuning({ activation }) });

    const [score] = expectOk(await classifier.classify([solidFrame(SIZE, 255)]));

    expect(score?.nsfw).toBeCloseTo(white);
    await classifier.close();
  });

  it('names the model it runs', () => {
    expect(new OnnxFrameClassifier({ modelPath, model: tuning() }).modelVersion).toBe(
      'tiny-brightness'
    );
  });
});
