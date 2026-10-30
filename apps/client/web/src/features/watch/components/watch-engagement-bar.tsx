import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import type { Video } from '@vp/api-contracts';
import { useFormat, useT } from '@vp/intl-react';
import { useCan } from '@vp/permissions-react';
import { useApi } from '@vp/queries';
import { unwrapOr } from '@vp/result';
import { useToast } from '@vp/ui';

import { EngagementBar } from '#app/components/watch/engagement-bar';
import { useSignIn } from '#app/features/auth/hooks/use-sign-in';
import { channelQueryOptions } from '#app/features/channels/api/channel-queries';
import { ClipAction } from '#app/features/clips/components/clip-action';
import { useReaction } from '#app/features/reactions/hooks/use-reaction';
import { subscriptionStatusQueryOptions } from '#app/features/subscriptions/api/subscription-queries';
import { useSetSubscription } from '#app/features/subscriptions/hooks/use-set-subscription';

import { ShareDialog } from './share-dialog';

function ChannelSection({ channelId }: { channelId: string }) {
  const api = useApi();
  const { tOr } = useT();
  const showToast = useToast();
  const signIn = useSignIn();
  const canSubscribe = useCan('subscribe', 'Channel');

  const { data: channel } = useSuspenseQuery(channelQueryOptions(api, channelId));
  const { data: status } = useQuery({
    ...subscriptionStatusQueryOptions(api, channelId),
    enabled: canSubscribe,
  });
  const setSubscription = useSetSubscription(channelId);

  const subscribed = status?.subscribed ?? false;
  const toggle = () => {
    if (!canSubscribe) {
      signIn();
      return;
    }

    setSubscription.mutate(!subscribed, {
      onError: () => showToast({ tone: 'danger', title: tOr('watch.subscribeFailed', {}, '') }),
    });
  };

  return (
    <>
      <EngagementBar.Channel
        name={channel.displayName}
        avatarSrc={channel.avatarUrl ?? undefined}
        subscribers={tOr('channels.subscribers', { count: channel.subscriberCount }, '')}
        asChild
      >
        <Link to="/channel/$channelId" params={{ channelId: channel.id }} />
      </EngagementBar.Channel>
      <EngagementBar.Subscribe
        subscribed={subscribed}
        pending={setSubscription.isPending}
        onToggle={toggle}
      >
        {subscribed ? tOr('watch.subscribed', {}, '') : tOr('watch.subscribe', {}, '')}
      </EngagementBar.Subscribe>
    </>
  );
}

function ReactionSection({ video }: { video: Video }) {
  const { format } = useFormat();
  const { reaction, change } = useReaction(video.id);

  return (
    <EngagementBar.Reaction
      value={reaction}
      likes={unwrapOr(format({ type: 'count', value: video.likesCount }), '')}
      onChange={change}
    />
  );
}

/** The channel, Subscribe, the reactions and Share under a video's title. */
export function WatchEngagementBar({ video }: { video: Video }) {
  const signIn = useSignIn();

  return (
    <EngagementBar.Root>
      {video.channel && <ChannelSection channelId={video.channel.id} />}
      <EngagementBar.Actions>
        <ReactionSection video={video} />
        <ShareDialog video={video} />
        <ClipAction video={video} onSignIn={signIn} />
      </EngagementBar.Actions>
    </EngagementBar.Root>
  );
}
