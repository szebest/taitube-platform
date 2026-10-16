import { Outlet } from '@tanstack/react-router';
import { useLayoutMaxWidth } from '@vp/queries';
import { useId, useState } from 'react';

import { type SidebarState, saveSidebarState } from '#app/features/shell/sidebar-state';
import { Header } from '../header/header';
import { BottomNav, SideNav } from '../navigation/navigation';

export type AppShellProps = {
  /** The sidebar state the server read from the request, so the first paint matches the hydrated page. */
  sidebar: SidebarState;
};

export function AppShell({ sidebar }: AppShellProps) {
  const [state, setState] = useState(sidebar);
  const sidebarId = useId();
  const maxWidth = useLayoutMaxWidth();

  const expanded = state === 'expanded';

  const handleToggleSidebar = () => {
    const next = expanded ? 'collapsed' : 'expanded';
    setState(next);
    saveSidebarState(next);
  };

  return (
    <>
      <Header
        sidebarId={sidebarId}
        sidebarExpanded={expanded}
        onToggleSidebar={handleToggleSidebar}
      />
      <div className="tw:flex tw:pt-18">
        <SideNav id={sidebarId} expanded={expanded} />
        <main className="tw:min-w-0 tw:flex-1 tw:p-2 tw:pb-16 tw:sm:p-4 tw:md:pb-8">
          <div className="tw:mx-auto tw:w-full" style={{ maxWidth }}>
            <Outlet />
          </div>
        </main>
      </div>
      <BottomNav />
    </>
  );
}
