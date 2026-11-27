const COMBINING_MARKS = /\p{M}/gu;
const WHITESPACE_RUN = /\s+/g;
const REGEX_SPECIALS = /[.*+?^${}()|[\]\\]/g;
const WORD_EDGE_BEFORE = String.raw`(?<![\p{L}\p{N}])`;
const WORD_EDGE_AFTER = String.raw`(?![\p{L}\p{N}])`;

/** The one form words and text are compared in: no case, no accents, one space between words. */
export function foldForMatching(value: string): string {
  return value
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .normalize('NFC')
    .toLowerCase()
    .replace(WHITESPACE_RUN, ' ')
    .trim();
}

/** Whole words and phrases only, so "ass" never matches "classic". */
export function matchesBlockedWord(words: readonly string[], text: string): boolean {
  const folded = words.map(foldForMatching).filter((word) => word !== '');
  if (folded.length === 0) return false;

  const alternatives = folded.map((word) => word.replace(REGEX_SPECIALS, String.raw`\$&`));
  const pattern = new RegExp(
    `${WORD_EDGE_BEFORE}(?:${alternatives.join('|')})${WORD_EDGE_AFTER}`,
    'u'
  );
  return pattern.test(foldForMatching(text));
}
