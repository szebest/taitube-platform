import { Link, Outlet } from '@tanstack/react-router';
import { useT } from '@vp/intl-react';
import { useLayoutMaxWidth } from '@vp/queries';
import { Logo, ThemeMenu } from '@vp/ui';
import { useState } from 'react';

import { AppShell } from '#app/components/shell/app-shell';
import { type SidebarState, saveSidebarState } from '#app/features/shell/sidebar-state';
import { ShellAccountMenu } from './shell-account-menu';
import { ShellRail } from './shell-rail';
import { ShellSearch } from './shell-search';
import { ShellTabBar } from './shell-tab-bar';

export type RootShellProps = {
  sidebar: SidebarState;
};

export function RootShell({ sidebar }: RootShellProps) {
  const [state, setState] = useState(sidebar);
  const maxWidth = useLayoutMaxWidth();
  const { tOr } = useT();

  const handleRailStateChange = (next: 'open' | 'collapsed') => {
    const stored = next === 'open' ? 'expanded' : 'collapsed';
    setState(stored);
    saveSidebarState(stored);
  };

  return (
    <AppShell.Root
      railState={state === 'expanded' ? 'open' : 'collapsed'}
      onRailStateChange={handleRailStateChange}
    >
      <AppShell.Header
        logo={
          <Link to="/" aria-label={tOr('shell.brandHome', {}, '')} className="tw:flex">
            <Logo />
          </Link>
        }
        search={<ShellSearch />}
        actions={<ThemeMenu />}
        account={<ShellAccountMenu />}
      />
      <ShellRail />
      <AppShell.Main>
        <div className="tw:mx-auto tw:w-full" style={{ maxWidth }}>
          <Outlet />
        </div>
      </AppShell.Main>
      <ShellTabBar />
    </AppShell.Root>
  );
}
