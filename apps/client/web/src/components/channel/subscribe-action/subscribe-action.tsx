import { useToast } from '@kit/ui';
import { useQuery } from '@tanstack/react-query';
import { useApi, useFailureToast, useIdentityGuard } from '@vp/queries';
import { SubscribeButton } from '#app/components/channel/subscribe-button';
import { useRequireAccount } from '#app/hooks/use-require-account';
import { useSetSubscription } from '#app/hooks/use-set-subscription';
import { useT } from '#app/lib/messages';
import { subscriptionStatusQueryOptions } from '#app/lib/query-keys/subscription-keys';

export interface SubscribeActionProps {
  channelId: string;
  /** The video whose watch page this sits on, credited with the subscription. */
  fromVideoId?: string;
  className?: string;
}

/**
 * Subscribe for a channel, wherever it is shown; a guest who presses it gets the sign-in prompt and
 * subscribes once signed in, a failed write offers a retry, and a press that lands after an identity
 * switch is held and asked again in a toast.
 */
export function SubscribeAction({ channelId, fromVideoId, className }: SubscribeActionProps) {
  const api = useApi();
  const { tOr } = useT();
  const showFailure = useFailureToast();
  const toast = useToast();
  const guard = useIdentityGuard();
  const { allowed: canSubscribe, run } = useRequireAccount('subscribe');
  const status = useQuery({
    ...subscriptionStatusQueryOptions(api, channelId),
    enabled: canSubscribe,
  });
  const setSubscription = useSetSubscription(channelId, fromVideoId);

  const subscribed = status.data?.subscribed ?? false;
  const toggle = () => {
    const subscribe = () =>
      setSubscription.mutate(!subscribed, {
        onError: (error) => showFailure(tOr('watch.subscribeFailed', {}, ''), error, subscribe),
      });
    const askAgain = () =>
      toast({
        tone: 'warning',
        title: tOr('accounts.identityChanged', {}, ''),
        action: { label: tOr('accounts.sendAnyway', {}, ''), onAction: subscribe },
      });
    run(() => guard.guard(subscribe, askAgain), { kind: 'subscribe', id: channelId });
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
