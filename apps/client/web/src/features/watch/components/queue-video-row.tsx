import { Link } from '@tanstack/react-router';
import type { ReasonedVideo, VideoSummary } from '@vp/api-contracts';
import { useT } from '@vp/intl-react';

import { VideoCard } from '#app/components/video/video-card';
import { useDurationText } from '#app/hooks/use-duration-text';

export interface QueueVideoRowProps {
  video: VideoSummary;
  /** The video on the stage: it leaves the shared element name to the stage. */
  current?: boolean;
  reason?: ReasonedVideo['reason'];
}

/** One video of the queue or of "More like this" as a compact row, linked to its watch page. */
export function QueueVideoRow({ video, current = false, reason }: QueueVideoRowProps) {
  const { tOr } = useT();
  const { clock, spoken } = useDurationText(video.durationMs);

  const byline = [
    video.channel?.displayName,
    tOr('videos.views', { count: video.viewsCount ?? 0 }, ''),
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <VideoCard.Root variant="row" size="sm" videoId={current ? undefined : video.id}>
      <VideoCard.Thumb
        src={video.thumbnailUrl ?? video.posterUrl}
        duration={clock}
        spokenDuration={spoken}
      />
      <VideoCard.Title asChild>
        <Link to="/watch/$videoId" params={{ videoId: video.id }}>
          {video.title ?? tOr('browse.untitled', {}, '')}
        </Link>
      </VideoCard.Title>
      <VideoCard.Meta>{byline}</VideoCard.Meta>
      {reason && (
        <VideoCard.Reason>{tOr('home.reason', { kind: reason.kind }, '')}</VideoCard.Reason>
      )}
    </VideoCard.Root>
  );
}
