import type { VideoScreening } from '@vp/domain';
import type { ScreenResult } from '@vp/job-contracts';

/**
 * What a `package` job reads for a stored result. A moderator's approval settles the case, so a
 * re-process of an approved video is not held again.
 */
export function toScreenResult(record: VideoScreening): ScreenResult {
  const approved = record.decision === 'approved';
  return {
    type: 'screen',
    screeningId: record.id,
    outcome: approved ? 'PASS' : record.outcome,
    score: record.score,
    reasons: approved ? [] : record.reasons.map((finding) => finding.reason),
  };
}
