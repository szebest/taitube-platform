export interface Searchable {
  label: string;
  keywords: string;
}

function includesEvery(text: string, terms: readonly string[]): boolean {
  return terms.every((term) => text.includes(term));
}

/**
 * The entries every word of `query` is found in, by label or keyword, those named by their label
 * first. A query of no words finds nothing.
 */
export function searchSettings<T extends Searchable>(entries: readonly T[], query: string): T[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [];

  const named = entries.filter((entry) => includesEvery(entry.label.toLowerCase(), terms));
  const described = entries.filter(
    (entry) =>
      !named.includes(entry) &&
      includesEvery(`${entry.label} ${entry.keywords}`.toLowerCase(), terms)
  );
  return [...named, ...described];
}
