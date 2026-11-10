import { Link, useMatchRoute } from '@tanstack/react-router';
import { useT } from '@vp/intl-react';
import { StudioWorkspace } from '#app/components/workspace/studio-workspace';
import { useMyInvites } from '#app/features/team/hooks/use-my-invites';

/** The way to the invites, with how many wait; absent while none does. */
export function InvitesNavItem() {
  const { tOr } = useT();
  const matchRoute = useMatchRoute();
  const count = useMyInvites().data?.length ?? 0;

  if (count === 0) {
    return null;
  }

  return (
    <StudioWorkspace.NavItem
      asChild
      icon="bell"
      active={Boolean(matchRoute({ to: '/invites' }))}
      badge={tOr('studio.invitesNavBadge', { count }, String(count))}
    >
      <Link to="/invites" search={{}}>
        {tOr('studio.invitesNav', {}, '')}
      </Link>
    </StudioWorkspace.NavItem>
  );
}
