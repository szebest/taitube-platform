import { CHANNEL_MAX, FrameClassifier, type FrameScores, type RgbFrame } from '@vp/core/ports';
import type { MediaFailure } from '@vp/errors';
import { type Result, ok } from '@vp/result';

export type FrameScorer = (frame: RgbFrame) => number;

const meanBrightness: FrameScorer = ({ data }) => {
  if (data.length === 0) return 0;
  return data.reduce((sum, byte) => sum + byte, 0) / data.length / CHANNEL_MAX;
};

/** Scores the `nsfw` label by how bright the frame is, so a fixture decides the outcome. */
export class InMemoryFrameClassifier extends FrameClassifier {
  readonly modelVersion = 'in-memory';
  readonly inputSize: number;
  private readonly score: FrameScorer;

  constructor(options: { inputSize: number; score?: FrameScorer }) {
    super();
    this.inputSize = options.inputSize;
    this.score = options.score ?? meanBrightness;
  }

  async classify(frames: readonly RgbFrame[]): Promise<Result<FrameScores[], MediaFailure>> {
    return ok(frames.map((frame) => ({ nsfw: this.score(frame) })));
  }
}
