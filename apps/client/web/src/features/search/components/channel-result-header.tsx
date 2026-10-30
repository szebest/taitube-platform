import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useRouterState } from '@tanstack/react-router';
import { useT } from '@vp/intl-react';
import { useAccount, useApi } from '@vp/queries';
import { Button } from '@vp/ui';

import { ChannelHeader } from '#app/components/channel/channel-header';
import { subscriptionStatusQueryOptions } from '#app/features/subscriptions/api/subscription-queries';
import { useSetSubscription } from '#app/features/subscriptions/hooks/use-set-subscription';
import type { ChannelHit } from '../search-hits';
import { MatchedText } from './matched-text';

export interface ChannelResultHeaderProps {
  channel: ChannelHit;
  terms: readonly string[];
}

/** A channel among the search results, or the spotlight above them: its identity row with Subscribe. */
export function ChannelResultHeader({ channel, terms }: ChannelResultHeaderProps) {
  const api = useApi();
  const account = useAccount();
  const navigate = useNavigate();
  const href = useRouterState({ select: (state) => state.location.href });
  const { tOr } = useT();
  const status = useQuery({
    ...subscriptionStatusQueryOptions(api, channel.id),
    enabled: account !== undefined,
  });
  const { mutate, isPending } = useSetSubscription(channel.id);

  const subscribed = status.data?.subscribed ?? false;
  const toggle = () => {
    if (account === undefined) {
      navigate({ to: '/login', search: { redirect: href } });
      return;
    }
    mutate(!subscribed);
  };

  return (
    <ChannelHeader.Root layout="identity">
      <ChannelHeader.Identity
        name={channel.displayName}
        handle={tOr('channels.handle', { handle: channel.handle }, '')}
        avatarSrc={channel.avatarUrl ?? undefined}
        stats={tOr('channels.subscribers', { count: channel.subscriberCount }, '')}
      >
        {channel.bio && (
          <ChannelHeader.Bio>
            <MatchedText text={channel.bio} terms={terms} />
          </ChannelHeader.Bio>
        )}
        <ChannelHeader.Actions>
          <ChannelHeader.Subscribe subscribed={subscribed} pending={isPending} onClick={toggle}>
            {tOr(subscribed ? 'channels.subscribed' : 'channels.subscribe', {}, '')}
          </ChannelHeader.Subscribe>
          <Button asChild variant="soft" tone="neutral">
            <Link to="/channel/$channelId" params={{ channelId: channel.id }}>
              {tOr('search.viewChannel', {}, '')}
            </Link>
          </Button>
        </ChannelHeader.Actions>
      </ChannelHeader.Identity>
    </ChannelHeader.Root>
  );
}
