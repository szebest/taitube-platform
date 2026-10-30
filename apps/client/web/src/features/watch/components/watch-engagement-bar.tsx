import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { Link, useLocation, useNavigate } from '@tanstack/react-router';
import type { Video } from '@vp/api-contracts';
import { useFormat, useT } from '@vp/intl-react';
import { useCan } from '@vp/permissions-react';
import { useApi } from '@vp/queries';
import { unwrapOr } from '@vp/result';
import { useToast } from '@vp/ui';

import { EngagementBar, type EngagementBarReaction } from '#app/components/watch/engagement-bar';
import { channelQueryOptions } from '#app/features/channels/api/channel-queries';
import { myReactionQueryOptions } from '#app/features/reactions/api/reaction-queries';
import { useSetReaction } from '#app/features/reactions/hooks/use-set-reaction';
import { subscriptionStatusQueryOptions } from '#app/features/subscriptions/api/subscription-queries';
import { useSetSubscription } from '#app/features/subscriptions/hooks/use-set-subscription';

import { ShareDialog } from './share-dialog';

function useSignIn() {
  const navigate = useNavigate();
  const redirect = useLocation({ select: ({ href }) => href });

  return () => navigate({ to: '/login', search: { redirect } });
}

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
  const api = useApi();
  const { tOr } = useT();
  const { format } = useFormat();
  const showToast = useToast();
  const signIn = useSignIn();
  const canReact = useCan('react', 'Video');

  const { data: mine } = useQuery({
    ...myReactionQueryOptions(api, video.id),
    enabled: canReact,
  });
  const setReaction = useSetReaction(video.id);

  const change = (next: EngagementBarReaction) => {
    if (!canReact) {
      signIn();
      return;
    }

    setReaction.mutate(next ?? 'NONE', {
      onError: () => showToast({ tone: 'danger', title: tOr('watch.reactionFailed', {}, '') }),
    });
  };

  return (
    <EngagementBar.Reaction
      value={mine?.reaction ?? null}
      likes={unwrapOr(format({ type: 'count', value: video.likesCount }), '')}
      onChange={change}
    />
  );
}

/** The channel, Subscribe, the reactions and Share under a video's title. */
export function WatchEngagementBar({ video }: { video: Video }) {
  return (
    <EngagementBar.Root>
      {video.channel && <ChannelSection channelId={video.channel.id} />}
      <EngagementBar.Actions>
        <ReactionSection video={video} />
        <ShareDialog video={video} />
      </EngagementBar.Actions>
    </EngagementBar.Root>
  );
}
