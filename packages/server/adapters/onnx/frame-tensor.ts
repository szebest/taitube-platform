import { CHANNEL_MAX, RGB_CHANNELS, type RgbFrame } from '@vp/core/ports';
import { ErrorCodes, type MediaFailure, mediaFailure } from '@vp/errors';
import { type Result, err, ok } from '@vp/result';

export interface FrameNormalization {
  inputSize: number;
  mean: number;
  std: number;
}

/**
 * Packs frames into one planar float tensor, `[frames, 3, size, size]`, each value scaled to 0..1 and
 * then normalised, which is the layout and range the exported image models take.
 */
export function packFrames(
  frames: readonly RgbFrame[],
  { inputSize, mean, std }: FrameNormalization
): Result<Float32Array, MediaFailure> {
  const plane = inputSize * inputSize;
  const wrong = frames.find(
    (frame) =>
      frame.width !== inputSize ||
      frame.height !== inputSize ||
      frame.data.length !== plane * RGB_CHANNELS
  );
  if (wrong) {
    return err(
      mediaFailure(
        'screen',
        ErrorCodes.SCREEN_MODEL_FAILED,
        `A ${wrong.width}x${wrong.height} frame was given to a model that takes ${inputSize}x${inputSize}`
      )
    );
  }

  const tensor = new Float32Array(frames.length * RGB_CHANNELS * plane);
  for (const [index, frame] of frames.entries()) {
    const base = index * RGB_CHANNELS * plane;
    for (let pixel = 0; pixel < plane; pixel += 1) {
      for (let channel = 0; channel < RGB_CHANNELS; channel += 1) {
        const value = (frame.data[pixel * RGB_CHANNELS + channel] ?? 0) / CHANNEL_MAX;
        tensor[base + channel * plane + pixel] = (value - mean) / std;
      }
    }
  }
  return ok(tensor);
}
