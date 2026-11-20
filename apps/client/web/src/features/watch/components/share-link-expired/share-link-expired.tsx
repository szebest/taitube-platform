import { useT } from '@kit/intl-react';
import { Link } from '@tanstack/react-router';
import { AccessGate } from '#app/components/watch/access-gate';

/** `/watch/$videoId?s=` for a share link that expired or was revoked. */
export function ShareLinkExpired() {
  const { tOr } = useT();

  return (
    <AccessGate.Root icon="clock">
      <AccessGate.Title>{tOr('watch.linkExpiredTitle', {}, '')}</AccessGate.Title>
      <AccessGate.Description>{tOr('watch.linkExpiredDescription', {}, '')}</AccessGate.Description>
      <AccessGate.Action asChild variant="solid" tone="accent">
        <Link to="/">{tOr('watch.linkExpiredHome', {}, '')}</Link>
      </AccessGate.Action>
    </AccessGate.Root>
  );
}
