import { Link } from '@tanstack/react-router';
import type { VideoSummary } from '@vp/api-contracts';
import { VideoCard } from '@vp/components';
import { useT } from '@vp/intl-react';
import { useVideoActions } from '#app/hooks/use-video-actions';

export interface ShortPosterCardProps {
  video: VideoSummary;
}

/** A Short as a 9:16 poster, linked to the Shorts player opened on it. */
export function ShortPosterCard({ video }: ShortPosterCardProps) {
  const { tOr } = useT();
  const { save, enqueue } = useVideoActions(video.id);

  return (
    <VideoCard.Root variant="poster" videoId={video.id}>
      <VideoCard.Thumb src={video.thumbnailUrl ?? video.posterUrl} />
      <VideoCard.Title asChild>
        <Link to="/shorts/$videoId" params={{ videoId: video.id }}>
          {video.title ?? tOr('browse.untitled', {}, '')}
        </Link>
      </VideoCard.Title>
      <VideoCard.Menu onSave={save} onQueue={enqueue} />
    </VideoCard.Root>
  );
}
