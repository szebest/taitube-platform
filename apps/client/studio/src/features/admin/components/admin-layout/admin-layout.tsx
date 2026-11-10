import { Link, Outlet } from '@tanstack/react-router';
import { useT } from '@vp/intl-react';

const TAB =
  'rounded-control px-inset-control py-inline text-label text-fg-muted no-underline hover:bg-tint focus-ring';
const ACTIVE_TAB = { className: 'bg-accent-soft text-accent-ink' };

/** The admin area's frame: its sections as links above the page the route renders. */
export function AdminLayout() {
  const { tOr } = useT();

  return (
    <div className="flex flex-col gap-stack">
      <nav aria-label={tOr('studio.adminTabs', {}, '')} className="flex gap-inline">
        <Link to="/admin/categories" className={TAB} activeProps={ACTIVE_TAB}>
          {tOr('studio.adminTabCategories', {}, '')}
        </Link>
        <Link to="/admin/curation" className={TAB} activeProps={ACTIVE_TAB}>
          {tOr('studio.adminTabCuration', {}, '')}
        </Link>
        <Link to="/admin/moderation" className={TAB} activeProps={ACTIVE_TAB}>
          {tOr('studio.adminTabModeration', {}, '')}
        </Link>
        <Link to="/admin/screening" className={TAB} activeProps={ACTIVE_TAB}>
          {tOr('studio.adminTabScreening', {}, '')}
        </Link>
        <Link to="/admin/queues" className={TAB} activeProps={ACTIVE_TAB}>
          {tOr('studio.adminTabQueues', {}, '')}
        </Link>
      </nav>
      <Outlet />
    </div>
  );
}
