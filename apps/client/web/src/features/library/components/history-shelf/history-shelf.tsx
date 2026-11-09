import { useSuspenseQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Shelf } from '@vp/components';
import { useT } from '@vp/intl-react';
import { useApi } from '@vp/queries';
import { FeedVideoCard } from '#app/components/video/feed-video-card';
import { historyShelfQueryOptions } from '#app/features/library/api/library-queries';
import { YouShelf } from '../you-shelf/you-shelf';

export function HistoryShelf() {
  const api = useApi();
  const { tOr } = useT();
  const { data } = useSuspenseQuery(historyShelfQueryOptions(api));

  return (
    <YouShelf
      shelf="history"
      link={(label) => <Link to="/feed/history">{label}</Link>}
      action={{
        label: tOr('library.browse', {}, ''),
        link: (label) => <Link to="/">{label}</Link>,
      }}
    >
      {data.items.map(({ id, video, progressSeconds, watchedAt }) => (
        <Shelf.Item key={id}>
          <FeedVideoCard video={{ ...video, viewer: { progressSeconds, watchedAt } }} />
        </Shelf.Item>
      ))}
    </YouShelf>
  );
}
