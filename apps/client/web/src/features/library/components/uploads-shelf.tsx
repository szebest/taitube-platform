import { useQuery } from '@tanstack/react-query';
import { Shelf } from '@vp/components';
import { useT } from '@vp/intl-react';
import { useAccount, useApi } from '@vp/queries';
import { STUDIO_URL } from '#app/config';
import { FeedVideoCard } from '#app/features/browse/components/feed-video-card';

import { uploadsShelfQueryOptions } from '../api/library-queries';
import { YouShelf } from './you-shelf';

const NO_CHANNEL = '';

/** The viewer's own uploads; the heading and the empty action lead to the studio, where they are managed. */
export function UploadsShelf() {
  const api = useApi();
  const account = useAccount();
  const { tOr } = useT();
  const { data } = useQuery({
    ...uploadsShelfQueryOptions(api, account?.channel.id ?? NO_CHANNEL),
    enabled: account !== undefined,
  });

  return (
    <YouShelf
      shelf="videos"
      link={(label) => <a href={STUDIO_URL}>{label}</a>}
      action={{
        label: tOr('library.upload', {}, ''),
        link: (label) => <a href={STUDIO_URL}>{label}</a>,
      }}
    >
      {(data?.items ?? []).map((video) => (
        <Shelf.Item key={video.id}>
          <FeedVideoCard video={video} />
        </Shelf.Item>
      ))}
    </YouShelf>
  );
}
