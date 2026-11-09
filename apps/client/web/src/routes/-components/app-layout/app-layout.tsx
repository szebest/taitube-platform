import { getRouteApi } from '@tanstack/react-router';
import { ApiProvider, SessionProvider, UserEventStream } from '@vp/queries';
import { ToastProvider, Tooltip } from '@vp/ui';
import { useWebTelemetry } from '@vp/web-telemetry';
import { Suspense } from 'react';
import { AccountMenu, PreferencesSync } from '#app/features/account';
import { LazyNewPlaylistDialog, LazySaveToPlaylistDialog } from '#app/features/library';
import { HeaderNotificationCentre } from '#app/features/notifications';
import { OfflineBanner, QueuedChangesSync } from '#app/features/offline';
import { InstallPrompt, UpdatePrompt } from '#app/features/pwa';
import { AppCommandPalette } from '#app/features/search';
import { RootShell } from '#app/features/shell';
import { LazyGlobalNowPlayingBar, PlaybackSessionProvider } from '#app/features/watch';
import { LazyDevtools } from '#app/integrations/devtools/devtools.lazy';
import { CommandPaletteProvider } from '#app/lib/command-palette/command-palette-store';
import { API_BASE_URL, OTEL_TRACES_URL } from '#app/lib/config';
import { DevicePreferencesProvider } from '#app/lib/preferences/device-preferences-provider';
import { urlModals } from '#app/lib/url-modal/registry';

const { UrlModal } = urlModals;

const rootRoute = getRouteApi('__root__');

export function AppLayout() {
  const { api, toaster, sidebarState, auth, devicePreferences } = rootRoute.useRouteContext();

  useWebTelemetry({ app: 'web', apiBaseUrl: API_BASE_URL, tracesUrl: OTEL_TRACES_URL });

  return (
    <>
      <ApiProvider api={api}>
        <SessionProvider session={auth}>
          <UserEventStream>
            <Tooltip.Provider>
              <ToastProvider toaster={toaster}>
                <DevicePreferencesProvider initial={devicePreferences}>
                  <PreferencesSync>
                    <PlaybackSessionProvider>
                      <CommandPaletteProvider>
                        <RootShell
                          sidebar={sidebarState}
                          account={<AccountMenu />}
                          actions={<HeaderNotificationCentre />}
                          notices={
                            <>
                              <OfflineBanner />
                              <InstallPrompt />
                            </>
                          }
                          nowPlaying={<LazyGlobalNowPlayingBar />}
                          overlays={
                            <>
                              <AppCommandPalette />
                              <UrlModal.WhenOpened id="save-to-playlist">
                                <LazySaveToPlaylistDialog />
                              </UrlModal.WhenOpened>
                              <UrlModal.WhenOpened id="new-playlist">
                                <LazyNewPlaylistDialog />
                              </UrlModal.WhenOpened>
                              <UpdatePrompt />
                              <QueuedChangesSync />
                            </>
                          }
                        />
                      </CommandPaletteProvider>
                    </PlaybackSessionProvider>
                  </PreferencesSync>
                </DevicePreferencesProvider>
              </ToastProvider>
            </Tooltip.Provider>
          </UserEventStream>
        </SessionProvider>
      </ApiProvider>
      <Suspense>
        <LazyDevtools />
      </Suspense>
    </>
  );
}
