const WORD = /[\p{L}\p{M}\p{N}]+/gu;
const REGEX_SPECIALS = /[.*+?^${}()|[\]\\]/g;

export type TextPart = { text: string; matched: boolean; start: number };

/** The words of a query that narrow a search: no `or`, no `-excluded` word, no quote marks. */
export function matchedTerms(query: string): string[] {
  const kept = query
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word !== 'or' && !word.startsWith('-'))
    .flatMap((word) => word.match(WORD) ?? []);
  return [...new Set(kept)].sort((a, b) => b.length - a.length);
}

function escapeRegExp(text: string): string {
  return text.replace(REGEX_SPECIALS, '\\$&');
}

/** Splits `text` so every part is either a match of a term or the text between two. */
export function splitOnTerms(text: string, terms: readonly string[]): TextPart[] {
  if (terms.length === 0 || text === '') {
    return [{ text, matched: false, start: 0 }];
  }
  const pattern = new RegExp(`(${terms.map(escapeRegExp).join('|')})`, 'giu');
  let start = 0;
  return text
    .split(pattern)
    .map((part, index): TextPart => {
      const at = start;
      start += part.length;
      return { text: part, matched: index % 2 === 1, start: at };
    })
    .filter((part) => part.text !== '');
}
