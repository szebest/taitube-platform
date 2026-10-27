import { dt } from '../define';

export const search = {
  resultsFor: dt('Results for {query}'),
  noResults: dt('No videos match {query}'),
  noQuery: dt('Type a word to search for'),
  searchFor: dt('Search for {query}'),
} as const;
