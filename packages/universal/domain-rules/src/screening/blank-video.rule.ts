import { type ScreeningFinding, type ScreeningThresholds, hammingDistance } from '@vp/domain';

export interface SampledFrame {
  hash: bigint;
  /** Mean luma of the frame, 0 to 255. */
  luma: number;
}

/**
 * A video whose sampled frames barely differ from its first one in picture and brightness is blank
 * or frozen. The score is the share of frames that match it. A clip with fewer than `blankMinFrames`
 * frames has nothing to compare, since a lone frame always matches itself.
 */
export function screenBlankVideo(
  frames: readonly SampledFrame[],
  thresholds: ScreeningThresholds
): ScreeningFinding | null {
  const [first] = frames;
  if (!first || frames.length < thresholds.blankMinFrames) return null;
  const matching = frames.filter(
    (frame) =>
      hammingDistance(frame.hash, first.hash) <= thresholds.blankMaxHamming &&
      Math.abs(frame.luma - first.luma) <= thresholds.blankMaxLumaRange
  ).length;
  const share = matching / frames.length;
  if (share < thresholds.blankFrameShare) return null;
  return { reason: 'BLANK', score: share, evidence: { frames: frames.length, matching } };
}
