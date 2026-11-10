import { ok } from '@vp/result';
import { CHANNEL_MAX, FrameClassifier, RGB_CHANNELS, type RgbFrame } from '../frame-classifier';

class WhiteIsExplicit extends FrameClassifier {
  readonly modelVersion = 'spec';
  readonly inputSize = 2;

  async classify(frames: readonly RgbFrame[]) {
    return ok(frames.map(({ data }) => ({ nsfw: data[0] === CHANNEL_MAX ? 1 : 0 })));
  }
}

describe('FrameClassifier', () => {
  it('describes a frame as three bytes of red, green and blue per pixel', () => {
    expect([RGB_CHANNELS, CHANNEL_MAX]).toEqual([3, 255]);
  });

  it('is the type a model adapter extends, so a stage takes any of them', async () => {
    const classifier: FrameClassifier = new WhiteIsExplicit();
    const white = { width: 2, height: 2, data: new Uint8Array(12).fill(CHANNEL_MAX) };

    const scores = await classifier.classify([white]);

    expect(scores.ok && scores.value).toEqual([{ nsfw: 1 }]);
  });
});
