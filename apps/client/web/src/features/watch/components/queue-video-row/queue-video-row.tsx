import { VideoCard } from '@kit/components';
import { useFormat } from '@kit/intl-react';
import { unwrapOr } from '@kit/result';
import { Link } from '@tanstack/react-router';
import type { ReasonedVideo, VideoSummary } from '@vp/api-contracts';
import { videoDuration } from '@vp/intl-formats';
import { FeedbackMenuItems } from '#app/components/video/feedback-menu-items';
import { useDurationText } from '#app/hooks/use-duration-text';
import { useImpression } from '#app/hooks/use-impression';
import { useVideoActions } from '#app/hooks/use-video-actions';
import { useT } from '#app/lib/messages';
import type { PlaybackRange } from '#app/lib/player/taitube-player-props';

export interface QueueVideoRowProps {
  video: VideoSummary;
  /** The video on the stage: it leaves the shared element name to the stage. */
  current?: boolean;
  reason?: ReasonedVideo['reason'];
  /** The playlist the row sits in: its link opens the video inside the playlist. */
  playlist?: { id: string; index: number };
  /** The video's number in a series, which leads its byline. */
  episode?: number;
  /** The stretch of the video the playlist plays, shown as a chip; a video played whole has none. */
  segment?: PlaybackRange;
}

const MS_PER_SECOND = 1000;

/** One video of the queue or of "More like this" as a compact row, linked to its watch page. */
export function QueueVideoRow({
  video,
  current = false,
  reason,
  playlist,
  episode,
  segment,
}: QueueVideoRowProps) {
  const { tOr } = useT();
  const { clock: durationClock, spoken } = useDurationText(video.durationMs);
  const { enqueue, playNext } = useVideoActions(video);
  const impression = useImpression(video);
  const { format } = useFormat();
  const clock = (ms: number) => unwrapOr(format(videoDuration(ms / MS_PER_SECOND)), '');

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
        duration={durationClock}
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
      {segment && (
        <span
          data-slot="queue-segment"
          className="col-start-2 w-fit rounded-chip bg-tint-strong px-2 text-body-sm text-fg-muted"
        >
          {tOr(
            'watch.queueSegment',
            { start: clock(segment.startMs), end: clock(segment.endMs) },
            ''
          )}
        </span>
      )}
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
