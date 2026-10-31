import { VideoCard } from '@vp/components';
import { useT } from '@vp/intl-react';

export interface YouPlaylistCardProps {
  id: string;
  title: string;
  videoCount: number;
}

/** A playlist of the viewer's as a `shelf` card: its title links to the list and its meta counts the videos. */
export function YouPlaylistCard({ id, title, videoCount }: YouPlaylistCardProps) {
  const { tOr } = useT();

  return (
    <VideoCard.Root variant="shelf" expandOnHover={false}>
      <VideoCard.Thumb />
      <VideoCard.Title asChild>
        <a href={`/playlist?list=${id}`}>{title}</a>
      </VideoCard.Title>
      <VideoCard.Meta>{tOr('library.playlistCount', { count: videoCount }, '')}</VideoCard.Meta>
    </VideoCard.Root>
  );
}
