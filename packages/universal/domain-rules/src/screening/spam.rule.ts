import type { ScreeningThresholds } from '@vp/domain';
import { type ScreeningMetadata, bodyOf, normalizedTitle, wordsOf } from './metadata-text';

const LINK = /https?:\/\/\S+|www\.\S+/giu;
const MIN_TERM_LENGTH = 3;
const MIN_WORDS_FOR_REPEATS = 8;
const MIN_LETTERS_FOR_CAPS = 10;

const SPAM_SIGNALS = ['links', 'tags', 'repeats', 'caps', 'sameTitle'] as const;
export type SpamSignal = (typeof SPAM_SIGNALS)[number];

export interface SpamMeasures {
  links: number;
  tags: number;
  repeatShare: number;
  capsShare: number;
  sameTitle: boolean;
}

function repeatShare(metadata: ScreeningMetadata): number {
  const terms = wordsOf([bodyOf(metadata), ...metadata.tags].join(' ')).filter(
    (word) => word.length >= MIN_TERM_LENGTH
  );
  if (terms.length < MIN_WORDS_FOR_REPEATS) return 0;
  const counts = new Map<string, number>();
  for (const term of terms) counts.set(term, (counts.get(term) ?? 0) + 1);
  return Math.max(...counts.values()) / terms.length;
}

function capsShare(metadata: ScreeningMetadata): number {
  const letters = Array.from(bodyOf(metadata)).filter((char) => /\p{L}/u.test(char));
  if (letters.length < MIN_LETTERS_FOR_CAPS) return 0;
  const upper = letters.filter(
    (char) => char === char.toUpperCase() && char !== char.toLowerCase()
  );
  return upper.length / letters.length;
}

export function measureSpam(metadata: ScreeningMetadata): SpamMeasures {
  const title = normalizedTitle(metadata.title);
  return {
    links: bodyOf(metadata).match(LINK)?.length ?? 0,
    tags: metadata.tags.length,
    repeatShare: repeatShare(metadata),
    capsShare: capsShare(metadata),
    sameTitle:
      title !== '' && metadata.recentTitles.some((recent) => normalizedTitle(recent) === title),
  };
}

/** The signals whose measure is past its threshold. */
export function spamSignals(measures: SpamMeasures, thresholds: ScreeningThresholds): SpamSignal[] {
  const tripped: Record<SpamSignal, boolean> = {
    links: measures.links > thresholds.spamMaxLinks,
    tags: measures.tags > thresholds.spamMaxTags,
    repeats: measures.repeatShare > thresholds.spamMaxRepeatShare,
    caps: measures.capsShare > thresholds.spamMaxCapsShare,
    sameTitle: measures.sameTitle,
  };
  return SPAM_SIGNALS.filter((signal) => tripped[signal]);
}
