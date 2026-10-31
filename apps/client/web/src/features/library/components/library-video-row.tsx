import { Link } from '@tanstack/react-router';
import type { VideoSummary } from '@vp/api-contracts';
import { publishedAt } from '@vp/intl';
import { Format, useT } from '@vp/intl-react';
import type { ReactNode } from 'react';

import { VideoCard } from '#app/components/video/video-card';
import { useDurationText } from '#app/hooks/use-duration-text';
import { useVideoActions } from '#app/hooks/use-video-actions';

export interface LibraryVideoRowProps {
  video: VideoSummary;
  /** The instant shown beside the views: when it was watched, or published. */
  at: string;
  /** How much was watched, 0 to 1. */
  progress?: number;
  /** Where the watch page starts, in seconds. */
  resumeAt?: number;
  /** The playlist the video is played from, and its place in it. */
  playlist?: { id: string; index: number };
  /** `DropdownMenu.Item`s for the card's menu, after Save and Queue. */
  actions: ReactNode;
}

/** One video of a library list as a `row` card, linked to its watch page and its channel. */
export function LibraryVideoRow({
  video,
  at,
  progress,
  resumeAt,
  playlist,
  actions,
}: LibraryVideoRowProps) {
  const { tOr } = useT();
  const { save, enqueue } = useVideoActions(video.id);
  const { clock, spoken } = useDurationText(video.durationMs);
  const { channel } = video;

  return (
    <VideoCard.Root variant="row" videoId={video.id}>
      <VideoCard.Thumb
        src={video.thumbnailUrl ?? video.posterUrl}
        duration={clock}
        spokenDuration={spoken}
        progress={progress}
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
        <Link
          to="/watch/$videoId"
          params={{ videoId: video.id }}
          search={{ t: resumeAt, list: playlist?.id, index: playlist?.index }}
        >
          {video.title ?? tOr('browse.untitled', {}, '')}
        </Link>
      </VideoCard.Title>
      <VideoCard.Meta>
        {tOr('videos.views', { count: video.viewsCount ?? 0 }, '')}
        {' · '}
        <time dateTime={at}>
          <Format value={publishedAt(at).relative} />
        </time>
      </VideoCard.Meta>
      <VideoCard.Menu onSave={save} onQueue={enqueue}>
        {actions}
      </VideoCard.Menu>
    </VideoCard.Root>
  );
}
