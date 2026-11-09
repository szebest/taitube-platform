import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import type { Video } from '@vp/api-contracts';
import { useFormat, useT } from '@vp/intl-react';
import { useCan } from '@vp/permissions-react';
import { SectionBoundary, useApi, useFailureToast } from '@vp/queries';
import { unwrapOr } from '@vp/result';
import { BrandScope, useUiCopy } from '@vp/ui';
import type { ReactNode } from 'react';
import { EngagementBar } from '#app/components/watch/engagement-bar';
import { ShareDialog } from '#app/components/watch/share-dialog';
import { toSummary } from '#app/features/watch/utils/to-summary';
import { useReaction } from '#app/hooks/use-reaction';
import { useSetSubscription } from '#app/hooks/use-set-subscription';
import { useSignIn } from '#app/hooks/use-sign-in';
import { useVideoActions } from '#app/hooks/use-video-actions';
import { channelQueryOptions } from '#app/lib/query-keys/channel-keys';
import { subscriptionStatusQueryOptions } from '#app/lib/query-keys/subscription-keys';

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
    <BrandScope color={channel.brandColor}>
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
    </BrandScope>
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

function SaveSection({ video }: { video: Video }) {
  const { save } = useVideoActions(toSummary(video));
  const { save: label } = useUiCopy();

  if (!save) return null;
  return (
    <EngagementBar.Action icon="save" onClick={save}>
      {label}
    </EngagementBar.Action>
  );
}

export interface WatchEngagementBarProps {
  video: Video;
  /** More actions after Save, from the features the route composes in. */
  renderActions?: (video: Video) => ReactNode;
}

/** The channel, Subscribe, the reactions, Share and Save under a video's title. */
export function WatchEngagementBar({ video, renderActions }: WatchEngagementBarProps) {
  const { tOr } = useT();

  return (
    <EngagementBar.Root>
      {video.channel && (
        <SectionBoundary
          message={tOr('watch.channelFailed', {}, '')}
          resetKey={video.channel.id}
          layout="bar"
        >
          <ChannelSection channelId={video.channel.id} />
        </SectionBoundary>
      )}
      <EngagementBar.Actions>
        <ReactionSection video={video} />
        <ShareDialog video={video} />
        <SaveSection video={video} />
        {renderActions?.(video)}
      </EngagementBar.Actions>
    </EngagementBar.Root>
  );
}
