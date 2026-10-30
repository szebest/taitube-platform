import { useQuery } from '@tanstack/react-query';
import { StartHereShelf } from '@vp/components';
import { useApi } from '@vp/queries';

import { FeedVideoCard } from '#app/features/browse/components/feed-video-card';
import { channelStartHereQueryOptions } from '#app/features/channels/api/channel-queries';

/** The shelf that opens a channel: the creator's pins in their order, else the most-watched uploads. */
export function ChannelStartHere({ channelId }: { channelId: string }) {
  const { data } = useQuery(channelStartHereQueryOptions(useApi(), channelId));

  if (data === undefined || data.items.length === 0) {
    return null;
  }

  return (
    <StartHereShelf.Root source={data.source}>
      <StartHereShelf.Header>
        <StartHereShelf.Kicker />
      </StartHereShelf.Header>
      <StartHereShelf.Track>
        {data.items.map((video, index) => (
          <StartHereShelf.Item key={video.id} position={String(index + 1)}>
            <FeedVideoCard video={video} />
          </StartHereShelf.Item>
        ))}
      </StartHereShelf.Track>
      <StartHereShelf.Footer>
        <StartHereShelf.Attribution />
      </StartHereShelf.Footer>
    </StartHereShelf.Root>
  );
}
