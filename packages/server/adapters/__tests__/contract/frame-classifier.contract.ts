import type { FrameClassifier, RgbFrame } from '@vp/core/ports';
import { expectOk } from '@vp/testing/result';

export interface FrameClassifierSubject {
  readonly classifier: FrameClassifier;
  close(): Promise<void>;
}

export function solidFrame(size: number, value: number): RgbFrame {
  return { width: size, height: size, data: new Uint8Array(size * size * 3).fill(value) };
}

/** Every classifier scores the `nsfw` label higher for a white frame than a black one. */
export function describeFrameClassifierContract(
  makeSubject: () => Promise<FrameClassifierSubject>
) {
  describe('FrameClassifier contract', () => {
    let subject: FrameClassifierSubject;

    beforeAll(async () => {
      subject = await makeSubject();
    });

    afterAll(async () => {
      await subject.close();
    });

    const classify = async (...values: number[]) => {
      const { classifier } = subject;
      return expectOk(
        await classifier.classify(values.map((value) => solidFrame(classifier.inputSize, value)))
      );
    };

    it('names its model and the size of frame it takes', () => {
      expect(subject.classifier.modelVersion).not.toBe('');
      expect(subject.classifier.inputSize).toBeGreaterThan(0);
    });

    it('answers no scores for no frames', async () => {
      expect(await classify()).toEqual([]);
    });

    it('scores each frame in the order given, every score from 0 to 1', async () => {
      const scores = await classify(255, 0, 255, 0, 255, 0, 255);

      expect(scores).toHaveLength(7);
      const nsfw = scores.map((frame) => frame.nsfw ?? Number.NaN);
      expect(nsfw.every((score) => score >= 0 && score <= 1)).toBe(true);
      expect(nsfw.map((score) => score > 0.5)).toEqual([
        true,
        false,
        true,
        false,
        true,
        false,
        true,
      ]);
    });
  });
}
