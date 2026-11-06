import { useT } from '@vp/intl-react';
import { useApi } from '@vp/queries';
import { subscriptionFeedQueryOptions } from '#app/features/browse/api/feed-queries';
import { VideoFeed } from '../video-feed/video-feed';

export function SubscriptionFeed() {
  const api = useApi();
  const { tOr } = useT();

  return (
    <VideoFeed
      title={tOr('channels.subscriptionVideosTitle', {}, '')}
      options={subscriptionFeedQueryOptions(api)}
    />
  );
}
