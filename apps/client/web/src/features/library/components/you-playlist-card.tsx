import { Link } from '@tanstack/react-router';
import { VideoCard } from '@vp/components';
import { useT } from '@vp/intl-react';

export interface YouPlaylistCardProps {
  id: string;
  title: string;
  videoCount: number;
  variant?: 'shelf' | 'grid';
}

/** A playlist of the viewer's as a card: its title links to the list and its meta counts the videos. */
export function YouPlaylistCard({
  id,
  title,
  videoCount,
  variant = 'shelf',
}: YouPlaylistCardProps) {
  const { tOr } = useT();

  return (
    <VideoCard.Root variant={variant} expandOnHover={false}>
      <VideoCard.Thumb />
      <VideoCard.Title asChild>
        <Link to="/playlist" search={{ list: id }}>
          {title}
        </Link>
      </VideoCard.Title>
      <VideoCard.Meta>{tOr('library.playlistCount', { count: videoCount }, '')}</VideoCard.Meta>
    </VideoCard.Root>
  );
}
