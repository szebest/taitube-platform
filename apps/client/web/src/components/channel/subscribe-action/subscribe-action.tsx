import { useQuery } from '@tanstack/react-query';
import { useT } from '@vp/intl-react';
import { useApi, useFailureToast } from '@vp/queries';
import { SubscribeButton } from '#app/components/channel/subscribe-button';
import { useRequireAccount } from '#app/hooks/use-require-account';
import { useSetSubscription } from '#app/hooks/use-set-subscription';
import { subscriptionStatusQueryOptions } from '#app/lib/query-keys/subscription-keys';

export interface SubscribeActionProps {
  channelId: string;
  className?: string;
}

/** Subscribe for a channel, wherever it is shown; a guest who presses it gets the sign-in prompt and subscribes once signed in, a failed write offers a retry. */
export function SubscribeAction({ channelId, className }: SubscribeActionProps) {
  const api = useApi();
  const { tOr } = useT();
  const showFailure = useFailureToast();
  const { allowed: canSubscribe, run } = useRequireAccount('subscribe');
  const status = useQuery({
    ...subscriptionStatusQueryOptions(api, channelId),
    enabled: canSubscribe,
  });
  const setSubscription = useSetSubscription(channelId);

  const subscribed = status.data?.subscribed ?? false;
  const toggle = () => {
    const subscribe = () =>
      setSubscription.mutate(!subscribed, {
        onError: (error) => showFailure(tOr('watch.subscribeFailed', {}, ''), error, subscribe),
      });
    run(subscribe, { kind: 'subscribe', id: channelId });
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
