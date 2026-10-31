import { Link } from '@tanstack/react-router';
import type { ReasonedVideo, VideoSummary } from '@vp/api-contracts';
import { publishedAt } from '@vp/intl';
import { Format, useT } from '@vp/intl-react';
import { useCan } from '@vp/permissions-react';
import { VideoCard } from '#app/components/video/video-card';
import { usePlaybackPreference } from '#app/features/settings/device/device-preferences-provider';
import { useDurationText } from '#app/hooks/use-duration-text';
import { useVideoActions } from '#app/hooks/use-video-actions';
import { FeedbackMenuItems } from '#app/features/recommendations/components/feedback-menu-items';
import { useWatchProgress } from '#app/hooks/use-watch-progress';

type ShelfReason = ReasonedVideo['reason'];

interface FeedVideoCardProps {
  video: VideoSummary;
  reason?: ShelfReason;
}

/** A video in a feed, a grid or a shelf: the card, linked to its watch page and its channel. */
export function FeedVideoCard({ video, reason }: FeedVideoCardProps) {
  const { tOr } = useT();
  const progress = useWatchProgress(video);
  const [hoverPreview] = usePlaybackPreference('hoverPreview');
  const { save, enqueue } = useVideoActions(video.id);
  const canGiveFeedback = useCan('create', 'RecommendationFeedback');

  const { clock, spoken } = useDurationText(video.durationMs);
  const { channel } = video;

  return (
    <VideoCard.Root variant="shelf" videoId={video.id} expandOnHover={hoverPreview}>
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
        <Link to="/watch/$videoId" params={{ videoId: video.id }}>
          {video.title ?? tOr('browse.untitled', {}, '')}
        </Link>
      </VideoCard.Title>
      <VideoCard.Meta>
        {tOr('videos.views', { count: video.viewsCount ?? 0 }, '')}
        {' · '}
        <time dateTime={video.createdAt}>
          <Format value={publishedAt(video.createdAt).relative} />
        </time>
      </VideoCard.Meta>
      {reason && (
        <VideoCard.Reason>{tOr('home.reason', { kind: reason.kind }, '')}</VideoCard.Reason>
      )}
      <VideoCard.Menu onSave={save} onQueue={enqueue}>
        {reason && canGiveFeedback ? <FeedbackMenuItems video={video} /> : undefined}
      </VideoCard.Menu>
      <VideoCard.Expanded onSave={save} onQueue={enqueue}>
        {video.description ?? undefined}
      </VideoCard.Expanded>
    </VideoCard.Root>
  );
}
