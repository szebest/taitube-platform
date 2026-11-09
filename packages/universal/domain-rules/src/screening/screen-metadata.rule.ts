import type { ScreeningFinding, ScreeningThresholds } from '@vp/domain';
import type { ScreeningMetadata } from './metadata-text';
import { findProfanity } from './profanity.rule';
import { measureSpam, spamSignals } from './spam.rule';

const SCORE_PRECISION = 1e4;

/**
 * Profanity and the spam signals on the title, description and tags. Every tripped signal adds the
 * same weight to one `METADATA_SPAM` finding, so one hit is a flag and enough of them reach the hold
 * score; `decideScreening` makes that call. No hit is no finding.
 */
export function screenMetadata(
  metadata: ScreeningMetadata,
  thresholds: ScreeningThresholds
): ScreeningFinding | null {
  const measures = measureSpam(metadata);
  const signals = spamSignals(measures, thresholds);
  const profanity = findProfanity(metadata);
  const hits = signals.length + (profanity.length > 0 ? 1 : 0);
  if (hits === 0) return null;
  const score = Math.min(
    1,
    Math.round(hits * thresholds.spamSignalWeight * SCORE_PRECISION) / SCORE_PRECISION
  );
  return { reason: 'METADATA_SPAM', score, evidence: { signals, profanity, ...measures } };
}
