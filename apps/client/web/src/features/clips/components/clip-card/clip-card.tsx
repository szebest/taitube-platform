import { VideoCard } from '@kit/components';
import { Link } from '@tanstack/react-router';
import type { ClipView } from '@vp/api-contracts';
import { useDurationText } from '#app/hooks/use-duration-text';
import { useT } from '#app/lib/messages';

/** A clip in a shelf: the video's frame at the clip's length, linked to the clip. */
export function ClipCard({ clip }: { clip: ClipView }) {
  const { tOr } = useT();
  const { clock, spoken } = useDurationText(clip.endMs - clip.startMs);
  const { video } = clip;

  return (
    <VideoCard.Root variant="shelf" videoId={video.id}>
      <VideoCard.Thumb
        src={video.thumbnailUrl ?? video.posterUrl}
        alt=""
        duration={clock}
        spokenDuration={spoken}
      />
      <VideoCard.Title asChild>
        <Link to="/clip/$clipId" params={{ clipId: clip.id }}>
          {clip.title}
        </Link>
      </VideoCard.Title>
      <VideoCard.Meta>{video.title ?? tOr('browse.untitled', {}, '')}</VideoCard.Meta>
    </VideoCard.Root>
  );
}
