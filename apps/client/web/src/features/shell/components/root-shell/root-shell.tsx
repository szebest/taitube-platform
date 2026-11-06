import { Link, Outlet } from '@tanstack/react-router';
import { useT } from '@vp/intl-react';
import { useLayoutMaxWidth } from '@vp/queries';
import { Logo, ThemeMenu } from '@vp/ui';
import { useState } from 'react';
import { AppShell } from '#app/components/shell/app-shell';
import { LazyNewPlaylistDialog } from '#app/features/library/components/new-playlist-dialog/new-playlist-dialog.lazy';
import { LazySaveToPlaylistDialog } from '#app/features/library/components/save-to-playlist-dialog/save-to-playlist-dialog.lazy';
import { HeaderNotificationCentre } from '#app/features/notifications/components/header-notification-centre/header-notification-centre';
import { OfflineBanner } from '#app/features/offline/components/offline-banner/offline-banner';
import { QueuedChangesSync } from '#app/features/offline/components/queued-changes-sync/queued-changes-sync';
import { InstallPrompt } from '#app/features/pwa/components/install-prompt/install-prompt';
import { UpdatePrompt } from '#app/features/pwa/components/update-prompt/update-prompt';
import { AppCommandPalette } from '#app/features/search/components/app-command-palette/app-command-palette';
import { CommandPaletteProvider } from '#app/features/search/components/command-palette-store/command-palette-store';
import { useImmersive } from '#app/features/shell/hooks/use-immersive';
import { type SidebarState, saveSidebarState } from '#app/features/shell/utils/sidebar-state';
import { LazyGlobalNowPlayingBar } from '#app/features/watch/components/global-now-playing-bar/global-now-playing-bar.lazy';
import { urlModals } from '#app/lib/url-modal/registry';
import { ShellAccountMenu } from '../shell-account-menu/shell-account-menu';
import { ShellRail } from '../shell-rail/shell-rail';
import { ShellSearch } from '../shell-search/shell-search';
import { ShellTabBar } from '../shell-tab-bar/shell-tab-bar';

const { UrlModal } = urlModals;

export type RootShellProps = {
  sidebar: SidebarState;
};

export function RootShell({ sidebar }: RootShellProps) {
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
    <CommandPaletteProvider>
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
              <HeaderNotificationCentre />
              <ThemeMenu />
            </>
          }
          account={<ShellAccountMenu />}
        />
        <ShellRail />
        <AppShell.Main>
          <div className="mx-auto w-full" style={{ maxWidth }}>
            <OfflineBanner />
            <InstallPrompt />
            <Outlet />
          </div>
        </AppShell.Main>
        <AppShell.NowPlaying>
          <LazyGlobalNowPlayingBar />
        </AppShell.NowPlaying>
        <ShellTabBar />
      </AppShell.Root>
      <AppCommandPalette />
      <UrlModal.WhenOpened id="save-to-playlist">
        <LazySaveToPlaylistDialog />
      </UrlModal.WhenOpened>
      <UrlModal.WhenOpened id="new-playlist">
        <LazyNewPlaylistDialog />
      </UrlModal.WhenOpened>
      <UpdatePrompt />
      <QueuedChangesSync />
    </CommandPaletteProvider>
  );
}
