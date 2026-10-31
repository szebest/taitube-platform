import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import type { Video } from '@vp/api-contracts';
import { useFormat, useT } from '@vp/intl-react';
import { useCan } from '@vp/permissions-react';
import { useApi, useFailureToast } from '@vp/queries';
import { unwrapOr } from '@vp/result';
import { useUiCopy } from '@vp/ui';

import { EngagementBar } from '#app/components/watch/engagement-bar';
import { useSignIn } from '#app/features/auth/hooks/use-sign-in';
import { channelQueryOptions } from '#app/features/channels/api/channel-queries';
import { ClipAction } from '#app/features/clips/components/clip-action';
import { useReaction } from '#app/features/reactions/hooks/use-reaction';
import { subscriptionStatusQueryOptions } from '#app/features/subscriptions/api/subscription-queries';
import { useSetSubscription } from '#app/features/subscriptions/hooks/use-set-subscription';
import { useVideoActions } from '#app/hooks/use-video-actions';

import { ShareDialog } from './share-dialog';

function ChannelSection({ channelId }: { channelId: string }) {
  const api = useApi();
  const { tOr } = useT();
  const showFailure = useFailureToast();
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

    const next = !subscribed;
    const subscribe = () =>
      setSubscription.mutate(next, {
        onError: (error) => showFailure(tOr('watch.subscribeFailed', {}, ''), error, subscribe),
      });
    subscribe();
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

function SaveSection({ videoId }: { videoId: string }) {
  const { save } = useVideoActions(videoId);
  const { save: label } = useUiCopy();

  if (!save) return null;
  return (
    <EngagementBar.Action icon="save" onClick={save}>
      {label}
    </EngagementBar.Action>
  );
}

/** The channel, Subscribe, the reactions, Share and Save under a video's title. */
export function WatchEngagementBar({ video }: { video: Video }) {
  const signIn = useSignIn();

  return (
    <EngagementBar.Root>
      {video.channel && <ChannelSection channelId={video.channel.id} />}
      <EngagementBar.Actions>
        <ReactionSection video={video} />
        <ShareDialog video={video} />
        <SaveSection videoId={video.id} />
        <ClipAction video={video} onSignIn={signIn} />
      </EngagementBar.Actions>
    </EngagementBar.Root>
  );
}
