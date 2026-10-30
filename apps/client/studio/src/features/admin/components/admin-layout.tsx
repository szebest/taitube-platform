import { Link, Outlet } from '@tanstack/react-router';
import { useT } from '@vp/intl-react';

const TAB =
  'tw:rounded-control tw:px-inset-control tw:py-inline tw:text-label tw:text-fg-muted tw:no-underline tw:hover:bg-tint tw:focus-ring';
const ACTIVE_TAB = { className: 'tw:bg-accent-soft tw:text-accent-ink' };

/** The admin area's frame: its sections as links above the page the route renders. */
export function AdminLayout() {
  const { tOr } = useT();

  return (
    <div className="tw:flex tw:flex-col tw:gap-stack">
      <nav aria-label={tOr('studio.adminTabs', {}, '')} className="tw:flex tw:gap-inline">
        <Link to="/admin/categories" className={TAB} activeProps={ACTIVE_TAB}>
          {tOr('studio.adminTabCategories', {}, '')}
        </Link>
        <Link to="/admin/moderation" className={TAB} activeProps={ACTIVE_TAB}>
          {tOr('studio.adminTabModeration', {}, '')}
        </Link>
        <Link to="/admin/queues" className={TAB} activeProps={ACTIVE_TAB}>
          {tOr('studio.adminTabQueues', {}, '')}
        </Link>
      </nav>
      <Outlet />
    </div>
  );
}
