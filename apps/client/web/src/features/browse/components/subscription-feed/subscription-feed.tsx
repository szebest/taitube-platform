import { useApi } from '@vp/queries';
import { useT } from '#app/lib/messages';
import { subscriptionFeedQueryOptions } from '#app/lib/query-keys/feed-keys';
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
