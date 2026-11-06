import { useT } from '@vp/intl-react';
import { AlertBanner } from '#app/components/live/alert-banner';
import { useSubscriberAlert } from '../hooks/use-subscriber-alert';

export interface OverlayAlertsProps {
  subscriberCount: number;
}

/** A banner and a chime each time the polled subscriber count rises. */
export function OverlayAlerts({ subscriberCount }: OverlayAlertsProps) {
  const { tOr } = useT();
  const announced = useSubscriberAlert(subscriberCount);

  if (announced === null) {
    return null;
  }

  return (
    <AlertBanner.Root key={announced}>
      <AlertBanner.Title>{tOr('studio.liveOverlayNewSubscriber', {}, '')}</AlertBanner.Title>
      <AlertBanner.Detail>
        {tOr('studio.liveOverlaySubscribers', { count: announced }, '')}
      </AlertBanner.Detail>
    </AlertBanner.Root>
  );
}
