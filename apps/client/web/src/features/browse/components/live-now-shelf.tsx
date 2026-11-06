import { useSuspenseQuery } from '@tanstack/react-query';
import { Shelf } from '@vp/components';
import { useT } from '@vp/intl-react';
import { useApi } from '@vp/queries';
import { liveNowQueryOptions } from '#app/features/live/api/live-queries';
import { LiveStreamCard } from '#app/features/live/components/live-stream-card';

/** The home's Live now shelf: the broadcasts live now, nothing when none is. */
export function LiveNowShelf() {
  const api = useApi();
  const { tOr } = useT();

  const { data } = useSuspenseQuery(liveNowQueryOptions(api));

  if (data.items.length === 0) {
    return null;
  }

  return (
    <Shelf.Root>
      <Shelf.Header>
        <Shelf.Title>{tOr('live.nowShelf', {}, '')}</Shelf.Title>
      </Shelf.Header>
      <Shelf.Track>
        {data.items.map((stream) => (
          <Shelf.Item key={stream.id}>
            <LiveStreamCard stream={stream} variant="shelf" />
          </Shelf.Item>
        ))}
      </Shelf.Track>
    </Shelf.Root>
  );
}
