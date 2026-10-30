import type { SearchResultItem } from '@vp/api-contracts';
import { assertNever } from '@vp/result';

import { ChannelResultHeader } from './channel-result-header';
import { SearchPlaylistResult } from './search-playlist-result';
import { SearchVideoResult } from './search-video-result';

export interface SearchResultProps {
  result: SearchResultItem;
  terms: readonly string[];
}

export function SearchResult({ result, terms }: SearchResultProps) {
  switch (result.type) {
    case 'video':
      return <SearchVideoResult video={result.data} terms={terms} />;
    case 'channel':
      return <ChannelResultHeader channel={result.data} terms={terms} />;
    case 'playlist':
      return <SearchPlaylistResult playlist={result.data} terms={terms} />;
    default:
      return assertNever(result, 'search result');
  }
}

export function searchResultKey(result: SearchResultItem): string {
  return `${result.type}:${result.data.id}`;
}
