import type { ScreeningFinding, ScreeningThresholds } from '@vp/domain';
import { findProfanity } from './profanity.rule';

/**
 * What is said in the video, against the same profanity list as its text. Only profanity is judged: a
 * transcript has no tags or links to count. The finding is a flag, tagged with its source so it sits
 * beside the one read from the title and never replaces it.
 */
export function screenTranscript(
  text: string,
  locale: string,
  thresholds: Pick<ScreeningThresholds, 'spamSignalWeight'>
): ScreeningFinding | null {
  const profanity = findProfanity({
    title: text,
    description: null,
    tags: [],
    locale,
    recentTitles: [],
  });
  if (profanity.length === 0) return null;
  return {
    reason: 'METADATA_SPAM',
    score: Math.min(1, thresholds.spamSignalWeight),
    evidence: { source: 'transcript', signals: ['profanity'], profanity },
  };
}
