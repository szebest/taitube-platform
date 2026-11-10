const QUESTION_MARKS = /[?？¿]/u;
const INTERROGATIVES = ['who', 'whom', 'whose', 'what', 'which', 'when', 'where', 'why', 'how'];
const SENTENCE_START = new RegExp(
  String.raw`(?:^|[.!?\n])\s*(?:${INTERROGATIVES.join('|')})(?![\p{L}\p{N}])`,
  'iu'
);

/** A marker for an inbox filter, not a classifier: a question mark, or a sentence opening on a wh-word. */
export function looksLikeQuestion(text: string): boolean {
  return QUESTION_MARKS.test(text) || SENTENCE_START.test(text);
}
