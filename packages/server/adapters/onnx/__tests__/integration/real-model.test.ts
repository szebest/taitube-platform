import { resolve } from 'node:path';
import { screeningConfig } from '@vp/env-schema';
import { expectOk } from '@vp/testing/result';
import { OnnxFrameClassifier } from '../../onnx-frame-classifier';

const MODEL =
  process.env.SCREENING_MODEL_PATH ??
  resolve(import.meta.dirname, '../../../../../../.models/vit-base-nsfw-detector-int8.onnx');

function gradient(size: number): { width: number; height: number; data: Uint8Array } {
  const data = new Uint8Array(size * size * 3);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const at = (y * size + x) * 3;
      data[at] = (x * 255) / size;
      data[at + 1] = (y * 255) / size;
      data[at + 2] = 128;
    }
  }
  return { width: size, height: size, data };
}

const { model } = screeningConfig({ enabled: true, modelPath: MODEL });

describe('OnnxFrameClassifier: the pinned model', () => {
  it('loads against its lock-file checksum and scores a neutral frame well under the hold threshold', async () => {
    const classifier = new OnnxFrameClassifier({ modelPath: MODEL, model });
    expectOk(await classifier.start());

    const frames = Array.from({ length: 1 }, () => gradient(model.inputSize));
    const scores = expectOk(await classifier.classify(frames));

    expect(scores).toHaveLength(frames.length);
    expect(scores.every((frame) => (frame.nsfw ?? 1) < 0.5)).toBe(true);
    await classifier.close();
  });
});
