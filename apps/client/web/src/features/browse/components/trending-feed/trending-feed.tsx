import { useT } from '@vp/intl-react';
import { useApi } from '@vp/queries';
import { publicFeedQueryOptions } from '#app/lib/query-keys/feed-keys';
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
