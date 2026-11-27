import { VideoCard } from '@kit/components';
import { Link } from '@tanstack/react-router';
import type { ReasonedVideo, VideoSummary } from '@vp/api-contracts';
import { FeedbackMenuItems } from '#app/components/video/feedback-menu-items';
import { useDurationText } from '#app/hooks/use-duration-text';
import { useImpression } from '#app/hooks/use-impression';
import { useVideoActions } from '#app/hooks/use-video-actions';
import { useT } from '#app/lib/messages';

export interface QueueVideoRowProps {
  video: VideoSummary;
  /** The video on the stage: it leaves the shared element name to the stage. */
  current?: boolean;
  reason?: ReasonedVideo['reason'];
  /** The playlist the row sits in: its link opens the video inside the playlist. */
  playlist?: { id: string; index: number };
  /** The video's number in a series, which leads its byline. */
  episode?: number;
}

/** One video of the queue or of "More like this" as a compact row, linked to its watch page. */
export function QueueVideoRow({
  video,
  current = false,
  reason,
  playlist,
  episode,
}: QueueVideoRowProps) {
  const { tOr } = useT();
  const { clock, spoken } = useDurationText(video.durationMs);
  const { enqueue, playNext } = useVideoActions(video);
  const impression = useImpression(video);

  const byline = [
    episode === undefined ? undefined : tOr('library.episode', { number: episode }, ''),
    video.channel?.displayName,
    tOr('videos.views', { count: video.viewsCount ?? 0 }, ''),
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <VideoCard.Root
      ref={impression}
      variant="row"
      size="sm"
      videoId={current ? undefined : video.id}
    >
      <VideoCard.Thumb
        src={video.thumbnailUrl ?? video.posterUrl}
        duration={clock}
        spokenDuration={spoken}
      />
      <VideoCard.Title asChild>
        <Link
          to="/watch/$videoId"
          params={{ videoId: video.id }}
          search={playlist && { list: playlist.id, index: playlist.index }}
        >
          {video.title ?? tOr('browse.untitled', {}, '')}
        </Link>
      </VideoCard.Title>
      <VideoCard.Meta>{byline}</VideoCard.Meta>
      {reason && (
        <VideoCard.Reason>{tOr('home.reason', { kind: reason.kind }, '')}</VideoCard.Reason>
      )}
      <VideoCard.Menu
        onQueue={reason ? enqueue : undefined}
        onPlayNext={reason ? playNext : undefined}
      >
        {reason ? <FeedbackMenuItems video={video} /> : undefined}
      </VideoCard.Menu>
    </VideoCard.Root>
  );
}
