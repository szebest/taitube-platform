import { VideoCard } from '@kit/components';
import { Link } from '@tanstack/react-router';
import type { VideoSummary } from '@vp/api-contracts';
import { useVideoActions } from '#app/hooks/use-video-actions';
import { useT } from '#app/lib/messages';

export interface ShortPosterCardProps {
  video: VideoSummary;
}

/** A Short as a 9:16 poster, linked to the Shorts player opened on it. */
export function ShortPosterCard({ video }: ShortPosterCardProps) {
  const { tOr } = useT();
  const { save, enqueue, playNext } = useVideoActions(video);

  return (
    <VideoCard.Root variant="poster" videoId={video.id}>
      <VideoCard.Thumb src={video.thumbnailUrl ?? video.posterUrl} />
      <VideoCard.Title asChild>
        <Link to="/shorts/$videoId" params={{ videoId: video.id }}>
          {video.title ?? tOr('browse.untitled', {}, '')}
        </Link>
      </VideoCard.Title>
      <VideoCard.Menu onSave={save} onQueue={enqueue} onPlayNext={playNext} />
    </VideoCard.Root>
  );
}
