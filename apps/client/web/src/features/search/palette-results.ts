import type { SearchResultItem, SearchSuggestion } from '@vp/api-contracts';
import { assertNever } from '@vp/result';
import type { PlaylistHit, VideoHit } from './search-hits';

export type PaletteResult =
  | { kind: 'video'; video: VideoHit }
  | {
      kind: 'channel';
      id: string;
      handle: string;
      name: string;
      avatarUrl: string | null;
      subscriberCount?: number;
    }
  | { kind: 'playlist'; playlist: PlaylistHit }
  | { kind: 'query'; text: string };

export interface PaletteGroups {
  videos: PaletteResult[];
  channels: PaletteResult[];
  playlists: PaletteResult[];
  queries: PaletteResult[];
}

/** Sorts hits and suggestions into the palette's groups; a channel in both appears once, as the suggestion. */
export function groupPaletteResults(
  hits: readonly SearchResultItem[],
  suggestions: readonly SearchSuggestion[]
): PaletteGroups {
  const groups: PaletteGroups = { videos: [], channels: [], playlists: [], queries: [] };
  const seen = new Set<string>();

  for (const suggestion of suggestions) {
    switch (suggestion.type) {
      case 'query':
        groups.queries.push({ kind: 'query', text: suggestion.text });
        break;
      case 'channel':
        seen.add(suggestion.channelId);
        groups.channels.push({
          kind: 'channel',
          id: suggestion.channelId,
          handle: suggestion.handle,
          name: suggestion.text,
          avatarUrl: suggestion.avatarUrl,
        });
        break;
      default:
        assertNever(suggestion, 'search suggestion');
    }
  }

  for (const hit of hits) {
    switch (hit.type) {
      case 'video':
        groups.videos.push({ kind: 'video', video: hit.data });
        break;
      case 'channel':
        if (!seen.has(hit.data.id)) {
          groups.channels.push({
            kind: 'channel',
            id: hit.data.id,
            handle: hit.data.handle,
            name: hit.data.displayName,
            avatarUrl: hit.data.avatarUrl,
            subscriberCount: hit.data.subscriberCount,
          });
        }
        break;
      case 'playlist':
        groups.playlists.push({ kind: 'playlist', playlist: hit.data });
        break;
      default:
        assertNever(hit, 'search hit');
    }
  }

  return groups;
}

/** The `cmdk` value and React key of a result, unique across the groups. */
export function paletteResultKey(result: PaletteResult): string {
  switch (result.kind) {
    case 'video':
      return `video:${result.video.id}`;
    case 'channel':
      return `channel:${result.id}`;
    case 'playlist':
      return `playlist:${result.playlist.id}`;
    case 'query':
      return `query:${result.text}`;
    default:
      return assertNever(result, 'palette result');
  }
}
