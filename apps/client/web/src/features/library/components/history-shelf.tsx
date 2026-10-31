import { useSuspenseQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useT } from '@vp/intl-react';
import { useApi } from '@vp/queries';

import { Shelf } from '#app/components/discovery/shelf';
import { FeedVideoCard } from '#app/features/browse/components/feed-video-card';

import { historyShelfQueryOptions } from '../api/library-queries';
import { YouShelf } from './you-shelf';

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
