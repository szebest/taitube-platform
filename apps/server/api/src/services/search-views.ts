import type { SearchResultItem, SearchSuggestion } from '@vp/api-contracts';
import type { PlaylistSearchCard, SearchHit } from '@vp/core/repositories';
import type { Channel } from '@vp/domain';
import type { CdnBase } from '@vp/env-schema';
import { cdnUrl, toVideoSummaryView } from './video-views';

function thumbnailOf({ playlist, coverKey }: PlaylistSearchCard, cdn: CdnBase): string | null {
  const key = playlist.customThumbnailKey ?? coverKey;
  return key ? cdnUrl(cdn, key) : null;
}

export function toSearchResultItem(hit: SearchHit, cdn: CdnBase): SearchResultItem {
  switch (hit.kind) {
    case 'video':
      return { type: 'video', data: toVideoSummaryView(hit.video, cdn) };
    case 'channel': {
      const { id, handle, displayName, avatarUrl, bio, subscriberCount } = hit.channel;
      return {
        type: 'channel',
        data: { id, handle, displayName, avatarUrl, bio, subscriberCount },
      };
    }
    case 'playlist': {
      const { playlist, owner, videoCount } = hit.card;
      return {
        type: 'playlist',
        data: {
          id: playlist.id,
          title: playlist.title,
          description: playlist.description,
          thumbnailUrl: thumbnailOf(hit.card, cdn),
          videoCount,
          owner,
          createdAt: playlist.createdAt.toISOString(),
          updatedAt: playlist.updatedAt.toISOString(),
        },
      };
    }
  }
}

export function toChannelSuggestion(channel: Channel): SearchSuggestion {
  const { id, handle, displayName, avatarUrl } = channel;
  return { type: 'channel', text: displayName, channelId: id, handle, avatarUrl };
}
