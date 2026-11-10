import type { MediaFailure } from '@vp/errors';
import type { Result } from '@vp/result';

/** The planes of a decoded frame and the largest value a byte of one holds. */
export const RGB_CHANNELS = 3;
export const CHANNEL_MAX = 255;

/** A decoded frame: `width * height` pixels of red, green and blue bytes, row by row. */
export interface RgbFrame {
  width: number;
  height: number;
  data: Uint8Array;
}

/** What a model says about one frame: a score from 0 to 1 per label it reports. */
export type FrameScores = Readonly<Record<string, number>>;

/**
 * Scores frames for the content-safety check. The model, its input size and its labels are the
 * adapter's; a caller asks for frames of `inputSize`, reads the labels it knows and decides nothing
 * about a model's internals.
 */
export abstract class FrameClassifier {
  /** Names the model that scored, stored with each result so a new model is visible in history. */
  abstract readonly modelVersion: string;
  /** The side, in pixels, of the square frames the model takes. */
  abstract readonly inputSize: number;
  /** One entry per frame, in order. A model that cannot load fails as `SCREEN_MODEL_INVALID`. */
  abstract classify(frames: readonly RgbFrame[]): Promise<Result<FrameScores[], MediaFailure>>;
}
