import { Link } from '@tanstack/react-router';
import { useT } from '@vp/intl-react';

import { VideoCard } from '#app/components/video/video-card';
import { playlistHref } from '../playlist-href';
import type { PlaylistHit } from '../search-hits';
import { MatchedText } from './matched-text';

export interface SearchPlaylistResultProps {
  playlist: PlaylistHit;
  terms: readonly string[];
}

/** A playlist among the search results: its cover, the video count, its owner and the matched title. */
export function SearchPlaylistResult({ playlist, terms }: SearchPlaylistResultProps) {
  const { tOr } = useT();
  const { owner } = playlist;
  const count = tOr('search.playlistVideos', { count: playlist.videoCount }, '');

  return (
    <VideoCard.Root variant="row">
      <VideoCard.Thumb src={playlist.thumbnailUrl ?? undefined} duration={count} />
      {owner && (
        <VideoCard.Byline name={owner.displayName} avatarSrc={owner.avatarUrl ?? undefined} asChild>
          <Link to="/channel/$channelId" params={{ channelId: owner.id }} />
        </VideoCard.Byline>
      )}
      <VideoCard.Title asChild>
        <a href={playlistHref(playlist.id)}>
          <MatchedText text={playlist.title} terms={terms} />
        </a>
      </VideoCard.Title>
      <VideoCard.Meta>{count}</VideoCard.Meta>
    </VideoCard.Root>
  );
}
