import { useQuery } from '@tanstack/react-query';
import { useT } from '@vp/intl-react';
import { useCan } from '@vp/permissions-react';
import { useApi, useFailureToast } from '@vp/queries';
import { SubscribeButton } from '#app/components/channel/subscribe-button';
import { useSetSubscription } from '#app/hooks/use-set-subscription';
import { useSignIn } from '#app/hooks/use-sign-in';
import { subscriptionStatusQueryOptions } from '#app/lib/query-keys/subscription-keys';

export interface SubscribeActionProps {
  channelId: string;
  className?: string;
}

/** Subscribe for a channel, wherever it is shown; a guest who presses it signs in and comes back, a failed write offers a retry. */
export function SubscribeAction({ channelId, className }: SubscribeActionProps) {
  const api = useApi();
  const { tOr } = useT();
  const showFailure = useFailureToast();
  const signIn = useSignIn();
  const canSubscribe = useCan('subscribe', 'Channel');
  const status = useQuery({
    ...subscriptionStatusQueryOptions(api, channelId),
    enabled: canSubscribe,
  });
  const setSubscription = useSetSubscription(channelId);

  const subscribed = status.data?.subscribed ?? false;
  const toggle = () => {
    if (!canSubscribe) {
      signIn();
      return;
    }

    const subscribe = () =>
      setSubscription.mutate(!subscribed, {
        onError: (error) => showFailure(tOr('watch.subscribeFailed', {}, ''), error, subscribe),
      });
    subscribe();
  };

  return (
    <SubscribeButton
      subscribed={subscribed}
      pending={setSubscription.isPending}
      onToggle={toggle}
      className={className}
    >
      {tOr(subscribed ? 'channels.subscribed' : 'channels.subscribe', {}, '')}
    </SubscribeButton>
  );
}
