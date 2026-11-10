import {
  SCREENING_REASONS,
  type ScreeningFinding,
  type ScreeningOutcome,
  type ScreeningReason,
  type ScreeningThresholds,
} from '@vp/domain';
import { type Result, assertNever, err, ok } from '@vp/result';
import { type InvalidScreeningFinding, invalidScreeningFinding } from './failures';

export interface ScreeningVerdict {
  outcome: ScreeningOutcome;
  score: number;
  /** The findings that hold the video, strongest first within each reason. */
  reasons: ScreeningFinding[];
  /** Findings for a moderator that never hold: they land in the queue and the video stays public. */
  flags: ScreeningFinding[];
}

function evidenceNumber(finding: ScreeningFinding, key: string): number {
  const value = finding.evidence[key];
  return typeof value === 'number' ? value : 0;
}

function holds(finding: ScreeningFinding, thresholds: ScreeningThresholds): boolean {
  switch (finding.reason) {
    case 'DUPLICATE':
      return finding.evidence.sameChannel !== true && finding.score >= thresholds.duplicateCoverage;
    case 'KNOWN_REJECTED':
      return finding.score >= thresholds.duplicateCoverage;
    case 'NSFW':
      return (
        finding.score >= thresholds.nsfwFrameThreshold &&
        evidenceNumber(finding, 'share') >= thresholds.nsfwShareThreshold
      );
    case 'BLANK':
      return finding.score >= thresholds.blankFrameShare;
    case 'METADATA_SPAM':
      return finding.score >= thresholds.spamHoldScore;
    case 'SCREEN_ERROR':
      return true;
    case 'PARTIAL_MATCH':
      return false;
    default:
      return assertNever(finding.reason, 'ScreeningReason');
  }
}

const REASON_ORDER: Record<ScreeningReason, number> = Object.fromEntries(
  SCREENING_REASONS.map((reason, index) => [reason, index])
) as Record<ScreeningReason, number>;

function byReasonThenScore(a: ScreeningFinding, b: ScreeningFinding): number {
  return REASON_ORDER[a.reason] - REASON_ORDER[b.reason] || b.score - a.score;
}

function strongest(findings: readonly ScreeningFinding[]): number {
  return findings.reduce((max, finding) => Math.max(max, finding.score), 0);
}

/**
 * `HOLD` when any finding passes its own bar, else `PASS`. A same-channel duplicate and a partial
 * match are advisory, so they are flags whatever their score. The score is the strongest finding
 * behind the outcome, and the thresholds in force are the caller's to store with the result.
 */
export function decideScreening(
  findings: readonly ScreeningFinding[],
  thresholds: ScreeningThresholds
): Result<ScreeningVerdict, InvalidScreeningFinding> {
  const invalid = findings.find(
    (finding) => !Number.isFinite(finding.score) || finding.score < 0 || finding.score > 1
  );
  if (invalid) return err(invalidScreeningFinding(invalid.reason, invalid.score));

  const sorted = [...findings].sort(byReasonThenScore);
  const reasons = sorted.filter((finding) => holds(finding, thresholds));
  const flags = sorted.filter((finding) => !holds(finding, thresholds));
  const outcome: ScreeningOutcome = reasons.length > 0 ? 'HOLD' : 'PASS';
  return ok({
    outcome,
    score: strongest(outcome === 'HOLD' ? reasons : flags),
    reasons,
    flags,
  });
}
