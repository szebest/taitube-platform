import { Shelf, StartHereShelf, VideoCard } from '@kit/components';
import type { VideoSummary } from '@vp/api-contracts';
import { useAppLink } from '@vp/queries';
import { WEB_URL } from '#app/lib/config';
import { useT } from '#app/lib/messages';

interface StartHerePreviewProps {
  channelId: string;
  pins: readonly VideoSummary[];
}

/** The shelf as the channel page draws it, over the pins as they stand now. */
export function StartHerePreview({ channelId, pins }: StartHerePreviewProps) {
  const { tOr } = useT();
  const appLink = useAppLink();

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
          <a href={appLink(WEB_URL, `/channel/${channelId}`)}>
            {tOr('studio.startHereViewChannel', {}, '')}
          </a>
        </Shelf.Action>
      </StartHereShelf.Footer>
    </StartHereShelf.Root>
  );
}
