import type { VideoSummary } from '@vp/api-contracts';
import { Shelf, StartHereShelf, VideoCard } from '@vp/components';
import { useT } from '@vp/intl-react';

import { WEB_URL } from '#app/config';

interface StartHerePreviewProps {
  channelId: string;
  pins: readonly VideoSummary[];
}

/** The shelf as the channel page draws it, over the pins as they stand now. */
export function StartHerePreview({ channelId, pins }: StartHerePreviewProps) {
  const { tOr } = useT();

  return (
    <StartHereShelf.Root source="pinned">
      <StartHereShelf.Header>
        <StartHereShelf.Kicker />
      </StartHereShelf.Header>
      <StartHereShelf.Track>
        {pins.map((video, index) => (
          <StartHereShelf.Item key={video.id} position={String(index + 1)}>
            <VideoCard.Root variant="shelf" videoId={video.id} expandOnHover={false}>
              <VideoCard.Thumb src={video.thumbnailUrl ?? video.posterUrl} />
              <VideoCard.Title>{video.title ?? tOr('browse.untitled', {}, '')}</VideoCard.Title>
              <VideoCard.Meta>
                {tOr('videos.views', { count: video.viewsCount ?? 0 }, '')}
              </VideoCard.Meta>
            </VideoCard.Root>
          </StartHereShelf.Item>
        ))}
      </StartHereShelf.Track>
      <StartHereShelf.Footer>
        <StartHereShelf.Attribution />
        <Shelf.Action asChild>
          <a href={`${WEB_URL}/channel/${channelId}`}>
            {tOr('studio.startHereViewChannel', {}, '')}
          </a>
        </Shelf.Action>
      </StartHereShelf.Footer>
    </StartHereShelf.Root>
  );
}
