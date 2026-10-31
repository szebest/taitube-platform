import { Link } from '@tanstack/react-router';
import { VideoCard } from '@vp/components';
import { publishedAt } from '@vp/intl';
import { Format, useT } from '@vp/intl-react';
import { useDurationText } from '#app/hooks/use-duration-text';
import { useVideoActions } from '#app/hooks/use-video-actions';
import type { VideoHit } from '../search-hits';
import { MatchedText } from './matched-text';

export interface SearchVideoResultProps {
  video: VideoHit;
  terms: readonly string[];
}

/** A video among the search results: a row with its byline, the matched title, its views and a snippet. */
export function SearchVideoResult({ video, terms }: SearchVideoResultProps) {
  const { tOr } = useT();
  const { clock, spoken } = useDurationText(video.durationMs);
  const { save, enqueue } = useVideoActions(video.id);
  const { channel } = video;

  return (
    <VideoCard.Root variant="row" videoId={video.id}>
      <VideoCard.Thumb
        src={video.thumbnailUrl ?? video.posterUrl}
        duration={clock}
        spokenDuration={spoken}
      />
      {channel && (
        <VideoCard.Byline
          name={channel.displayName}
          avatarSrc={channel.avatarUrl ?? undefined}
          asChild
        >
          <Link to="/channel/$channelId" params={{ channelId: channel.id }} />
        </VideoCard.Byline>
      )}
      <VideoCard.Title asChild>
        <Link to="/watch/$videoId" params={{ videoId: video.id }}>
          <MatchedText text={video.title ?? tOr('browse.untitled', {}, '')} terms={terms} />
        </Link>
      </VideoCard.Title>
      <VideoCard.Meta>
        {tOr('videos.views', { count: video.viewsCount ?? 0 }, '')}
        {' · '}
        <time dateTime={video.createdAt}>
          <Format value={publishedAt(video.createdAt).relative} />
        </time>
      </VideoCard.Meta>
      {video.description && (
        <VideoCard.Snippet>
          <MatchedText text={video.description} terms={terms} />
        </VideoCard.Snippet>
      )}
      <VideoCard.Menu onSave={save} onQueue={enqueue} />
    </VideoCard.Root>
  );
}
