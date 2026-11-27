import { Tabs } from '@kit/ui';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useApi } from '@vp/queries';
import { SUBSCRIPTION_TABS } from '#app/features/browse/utils/subscription-search';
import { useT } from '#app/lib/messages';
import { subscriptionFeedQueryOptions } from '#app/lib/query-keys/feed-keys';
import { SubscriptionCommunity } from '../subscription-community/subscription-community';
import { VideoFeed } from '../video-feed/video-feed';

/** `/subscriptions/videos`: the videos of the subscribed channels, and beside them their Community posts. */
export function SubscriptionFeed() {
  const api = useApi();
  const { tOr } = useT();
  const tab = useSearch({
    strict: false,
    select: ({ tab: open }) =>
      SUBSCRIPTION_TABS.find((candidate) => candidate === open) ?? 'videos',
  });
  const navigate = useNavigate();

  const openTab = (next: string) => {
    const picked = SUBSCRIPTION_TABS.find((candidate) => candidate === next);
    if (picked) {
      void navigate({ to: '.', search: { tab: picked }, replace: true });
    }
  };

  return (
    <Tabs.Root value={tab} onValueChange={openTab} className="flex flex-col gap-6">
      <Tabs.List aria-label={tOr('posts.subscriptionsTabsLabel', {}, '')}>
        {SUBSCRIPTION_TABS.map((value) => (
          <Tabs.Tab key={value} value={value}>
            {tOr('posts.subscriptionsTab', { tab: value }, '')}
          </Tabs.Tab>
        ))}
      </Tabs.List>
      <Tabs.Panel value="videos">
        <VideoFeed
          title={tOr('channels.subscriptionVideosTitle', {}, '')}
          options={subscriptionFeedQueryOptions(api)}
        />
      </Tabs.Panel>
      <Tabs.Panel value="community">
        <SubscriptionCommunity />
      </Tabs.Panel>
    </Tabs.Root>
  );
}
