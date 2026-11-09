import type { ScreeningFinding, ScreeningThresholds } from '@vp/domain';

export interface ScoredFrame {
  timestampSeconds: number;
  score: number;
}

export interface NsfwReading {
  finding: ScreeningFinding | null;
  /** The frames over the frame threshold, strongest first: the pool the evidence is picked from. */
  flagged: ScoredFrame[];
}

/**
 * The video's score is its strongest frame and the share is the part of the frames over the frame
 * threshold, so `decideScreening` can ask for both before it holds. A video with no frame over the
 * threshold has no finding at all.
 */
export function readNsfw(
  frames: readonly ScoredFrame[],
  thresholds: Pick<ScreeningThresholds, 'nsfwFrameThreshold'>
): NsfwReading {
  const flagged = frames
    .filter((frame) => frame.score >= thresholds.nsfwFrameThreshold)
    .sort((a, b) => b.score - a.score || a.timestampSeconds - b.timestampSeconds);
  const [strongest] = flagged;
  if (!strongest) return { finding: null, flagged };

  const share = flagged.length / frames.length;
  return {
    flagged,
    finding: {
      reason: 'NSFW',
      score: Math.min(1, strongest.score),
      evidence: { share, frames: frames.length, flagged: flagged.length },
    },
  };
}
