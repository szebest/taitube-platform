import { useInfiniteQuery } from '@tanstack/react-query';
import { Link, useMatchRoute } from '@tanstack/react-router';
import { useT } from '@vp/intl-react';
import { useApi } from '@vp/queries';
import { StudioWorkspace } from '#app/components/workspace/studio-workspace';
import { inboxQueryOptions } from '#app/features/comments/api/inbox-queries';

/** The review queue's entry in the navigation, counting the comments held for review as they arrive. */
export function ReviewQueueNavItem() {
  const { tOr } = useT();
  const matchRoute = useMatchRoute();
  const held = useInfiniteQuery({
    ...inboxQueryOptions(useApi(), 'held'),
    select: ({ pages }) => ({
      count: pages.reduce((total, { items }) => total + items.length, 0),
      more: pages.at(-1)?.nextCursor != null,
    }),
  });
  const { count = 0, more = false } = held.data ?? {};

  return (
    <StudioWorkspace.NavItem
      asChild
      icon="eye"
      active={Boolean(matchRoute({ to: '/comments/queue' }))}
      badge={count > 0 ? `${count}${more ? '+' : ''}` : undefined}
    >
      <Link to="/comments/queue">{tOr('studio.queueNav', {}, '')}</Link>
    </StudioWorkspace.NavItem>
  );
}
