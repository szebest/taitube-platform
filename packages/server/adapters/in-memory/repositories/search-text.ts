import { SEARCH_RANKING, type SearchWeight } from '@vp/domain';

const WORD_SEPARATOR = /[^\p{L}\p{N}]+/u;

/**
 * Words as the `simple` text search configuration sees them: lowercased runs of letters and digits.
 * @internal
 */
export function searchTokens(text: string): string[] {
  return text.toLowerCase().split(WORD_SEPARATOR).filter(Boolean);
}

export interface WeightedField {
  text: string;
  weight: SearchWeight;
}

/**
 * Every query word must occur in some field, as `websearch_to_tsquery` ANDs plain words; each adds
 * the weight of the heaviest field holding it. The double reads the words only: quoted phrases,
 * `or` and `-` are for Postgres to parse.
 */
export function lexicalScore(query: string, fields: readonly WeightedField[]): number {
  const tokenized = fields.map((field) => ({
    ...field,
    tokens: new Set(searchTokens(field.text)),
  }));
  let score = 0;
  for (const token of searchTokens(query)) {
    const weights = tokenized
      .filter((field) => field.tokens.has(token))
      .map((field) => SEARCH_RANKING.weights[field.weight]);
    if (weights.length === 0) return 0;
    score += Math.max(...weights);
  }
  return score;
}

function trigrams(text: string): Set<string> {
  const grams = new Set<string>();
  for (const word of searchTokens(text)) {
    const padded = `  ${word} `;
    for (let start = 0; start + 3 <= padded.length; start += 1) {
      grams.add(padded.slice(start, start + 3));
    }
  }
  return grams;
}

/**
 * The share of the query's trigrams found in the text, which bounds `pg_trgm`'s `word_similarity`
 * from above: close enough for a double to fall back on the same typos Postgres does.
 */
export function wordSimilarity(query: string, text: string): number {
  const wanted = trigrams(query);
  if (wanted.size === 0) return 0;
  const present = trigrams(text);
  let shared = 0;
  for (const gram of wanted) shared += present.has(gram) ? 1 : 0;
  return shared / wanted.size;
}
