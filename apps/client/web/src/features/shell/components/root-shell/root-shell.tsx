import { Link, Outlet } from '@tanstack/react-router';
import { useT } from '@vp/intl-react';
import { useLayoutMaxWidth } from '@vp/queries';
import { Logo, ThemeMenu } from '@vp/ui';
import { type ReactNode, useState } from 'react';
import { AppShell } from '#app/components/shell/app-shell';
import { useImmersive } from '#app/features/shell/hooks/use-immersive';
import { type SidebarState, saveSidebarState } from '#app/features/shell/utils/sidebar-state';
import { ShellRail } from '../shell-rail/shell-rail';
import { ShellSearch } from '../shell-search/shell-search';
import { ShellTabBar } from '../shell-tab-bar/shell-tab-bar';

export type RootShellProps = {
  sidebar: SidebarState;
  /** The header's account menu. */
  account: ReactNode;
  /** The header's actions beside the theme menu. */
  actions?: ReactNode;
  /** Above the page: banners and prompts. */
  notices?: ReactNode;
  /** The now playing bar of the shell. */
  nowPlaying?: ReactNode;
  /** Beside the shell: dialogs, the command palette and the effects that run for the whole app. */
  overlays?: ReactNode;
};

export function RootShell({
  sidebar,
  account,
  actions,
  notices,
  nowPlaying,
  overlays,
}: RootShellProps) {
  const [state, setState] = useState(sidebar);
  const maxWidth = useLayoutMaxWidth();
  const immersive = useImmersive();
  const { tOr } = useT();

  const handleRailStateChange = (next: 'open' | 'collapsed') => {
    const stored = next === 'open' ? 'expanded' : 'collapsed';
    setState(stored);
    saveSidebarState(stored);
  };

  return (
    <>
      <AppShell.Root
        variant={immersive ? 'immersive' : 'default'}
        railState={state === 'expanded' ? 'open' : 'collapsed'}
        onRailStateChange={handleRailStateChange}
      >
        <AppShell.Header
          logo={
            <Link to="/" aria-label={tOr('shell.brandHome', {}, '')} className="flex">
              <Logo />
            </Link>
          }
          search={<ShellSearch />}
          actions={
            <>
              {actions}
              <ThemeMenu />
            </>
          }
          account={account}
        />
        <ShellRail />
        <AppShell.Main>
          <div className="mx-auto w-full" style={{ maxWidth }}>
            {notices}
            <Outlet />
          </div>
        </AppShell.Main>
        <AppShell.NowPlaying>{nowPlaying}</AppShell.NowPlaying>
        <ShellTabBar />
      </AppShell.Root>
      {overlays}
    </>
  );
}
