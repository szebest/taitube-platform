import { useQuery } from '@tanstack/react-query';
import { useNavigate, useRouterState } from '@tanstack/react-router';
import { useT } from '@vp/intl-react';
import { useAccount, useApi } from '@vp/queries';
import { ChannelHeader } from '#app/components/channel/channel-header';
import { useSetSubscription } from '#app/hooks/use-set-subscription';
import { subscriptionStatusQueryOptions } from '#app/lib/query-keys/subscription-keys';

export interface SubscribeActionProps {
  channelId: string;
}

/** The Subscribe toggle of a `ChannelHeader`; a guest who presses it signs in and comes back. */
export function SubscribeAction({ channelId }: SubscribeActionProps) {
  const api = useApi();
  const account = useAccount();
  const navigate = useNavigate();
  const href = useRouterState({ select: (state) => state.location.href });
  const { tOr } = useT();
  const status = useQuery({
    ...subscriptionStatusQueryOptions(api, channelId),
    enabled: account !== undefined,
  });
  const { mutate, isPending } = useSetSubscription(channelId);

  const subscribed = status.data?.subscribed ?? false;
  const toggle = () => {
    if (account === undefined) {
      navigate({ to: '/login', search: { redirect: href } });
      return;
    }
    mutate(!subscribed);
  };

  return (
    <ChannelHeader.Subscribe subscribed={subscribed} pending={isPending} onClick={toggle}>
      {tOr(subscribed ? 'channels.subscribed' : 'channels.subscribe', {}, '')}
    </ChannelHeader.Subscribe>
  );
}
