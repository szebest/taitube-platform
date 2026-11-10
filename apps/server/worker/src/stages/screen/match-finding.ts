import type { ScreeningFinding, ScreeningThresholds } from '@vp/domain';
import type { VideoMatch } from '@vp/fingerprint';

export interface MatchedVideo {
  ownerId: string;
  status: string;
}

/**
 * A stored video the new one overlaps, as a finding a moderator can read. A near-total match is a
 * re-upload: `KNOWN_REJECTED` when the original was taken down, else `DUPLICATE`. A smaller overlap is
 * a `PARTIAL_MATCH`. The matched video's id stays in the evidence, which only a moderator sees.
 */
export function matchFinding(
  match: VideoMatch,
  original: MatchedVideo,
  ownerId: string,
  thresholds: Pick<ScreeningThresholds, 'duplicateCoverage'>
): ScreeningFinding {
  const reason =
    match.score < thresholds.duplicateCoverage
      ? 'PARTIAL_MATCH'
      : original.status === 'REJECTED'
        ? 'KNOWN_REJECTED'
        : 'DUPLICATE';
  return {
    reason,
    score: Math.min(1, match.score),
    evidence: {
      matchedVideoId: match.videoId,
      sameChannel: original.ownerId === ownerId,
      video: match.video,
      audio: match.audio,
    },
  };
}
