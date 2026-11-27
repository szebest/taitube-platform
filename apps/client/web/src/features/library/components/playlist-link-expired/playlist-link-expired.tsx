import { EmptyState } from '@kit/components';
import { Link } from '@tanstack/react-router';
import { useT } from '#app/lib/messages';

/** `/playlist?list=&s=` for a share link that expired or was revoked. */
export function PlaylistLinkExpired() {
  const { tOr } = useT();

  return (
    <EmptyState.Root size="page">
      <EmptyState.Title>{tOr('playlistPeople.shareExpiredTitle', {}, '')}</EmptyState.Title>
      <EmptyState.Description>
        {tOr('playlistPeople.shareExpiredBody', {}, '')}
      </EmptyState.Description>
      <EmptyState.Action asChild variant="solid" tone="accent">
        <Link to="/">{tOr('playlistPeople.goHome', {}, '')}</Link>
      </EmptyState.Action>
    </EmptyState.Root>
  );
}
