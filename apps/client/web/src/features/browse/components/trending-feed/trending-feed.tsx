import { useT } from '@vp/intl-react';
import { useApi } from '@vp/queries';

import { publicFeedQueryOptions } from '#app/features/feed/api/feed-queries';
import { VideoFeed } from '../video-feed/video-feed';

export function TrendingFeed() {
  const api = useApi();
  const { tOr } = useT();

  return (
    <VideoFeed
      title={tOr('shell.trending', {}, '')}
      options={publicFeedQueryOptions(api, { sort: 'trending' })}
    />
  );
}
