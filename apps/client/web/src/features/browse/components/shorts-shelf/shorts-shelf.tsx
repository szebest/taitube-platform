import { Shelf } from '@vp/components';
import { useT } from '@vp/intl-react';
import { useShortsFeed } from '#app/features/feed/hooks/use-shorts-feed';
import { ShortPosterCard } from '#app/features/shorts/components/short-poster-card';

/** The Shorts shelf: poster cards that open the Shorts player, more of them as the viewer scrolls on. */
export function ShortsShelf() {
  const { tOr } = useT();
  const { videos, hasMore, loadMore } = useShortsFeed();

  if (videos.length === 0) {
    return null;
  }

  return (
    <Shelf.Root variant="poster" onEndReached={hasMore ? loadMore : undefined}>
      <Shelf.Header>
        <Shelf.Title>{tOr('shorts.title', {}, '')}</Shelf.Title>
      </Shelf.Header>
      <Shelf.Track>
        {videos.map((video) => (
          <Shelf.Item key={video.id}>
            <ShortPosterCard video={video} />
          </Shelf.Item>
        ))}
      </Shelf.Track>
    </Shelf.Root>
  );
}
