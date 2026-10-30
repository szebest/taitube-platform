export const SEARCH_HISTORY_LIMIT = 100;
export const SEARCH_HISTORY_RETENTION_DAYS = 90;

export interface SearchHistoryEntry {
  id: string;
  query: string;
  searchedAt: Date;
}

export interface NewSearchHistoryEntry extends SearchHistoryEntry {
  userId: string;
  queryKey: string;
}

/** `query` is what the viewer typed, tidied; `queryKey` is what makes two spellings one row. */
export function searchHistoryText(raw: string): { query: string; queryKey: string } {
  const query = raw.trim().replace(/\s+/g, ' ');
  return { query, queryKey: query.toLowerCase() };
}
