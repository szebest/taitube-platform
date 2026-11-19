import { ToastProvider, Tooltip } from '@kit/ui';
import { useWebTelemetry } from '@kit/web-telemetry';
import { getRouteApi } from '@tanstack/react-router';
import { MAX_WEB_VITALS_PER_BATCH, recordWebVitals } from '@vp/api-contracts';
import {
  ApiProvider,
  SessionProvider,
  UserEventStream,
  useSessionSync,
  useTabIdentity,
} from '@vp/queries';
import { Suspense, useState } from 'react';
import {
  AccountMenu,
  ChannelPermissions,
  createMergeState,
  LazySignInDialog,
  MergeStateContext,
  PreferencesSync,
  ReplayIntent,
} from '#app/features/account';
import { LazyNewPlaylistDialog, LazySaveToPlaylistDialog } from '#app/features/library';
import { HeaderNotificationCentre } from '#app/features/notifications';
import { OfflineBanner, QueuedChangesSync } from '#app/features/offline';
import { InstallPrompt, UpdatePrompt } from '#app/features/pwa';
import { AppCommandPalette } from '#app/features/search';
import { RootShell } from '#app/features/shell';
import { LazyGlobalNowPlayingBar, PlaybackSessionProvider } from '#app/features/watch';
import { LazyDevtools } from '#app/integrations/devtools/devtools.lazy';
import { AmbientGlowProvider } from '#app/lib/ambient/ambient-glow';
import { CommandPaletteProvider } from '#app/lib/command-palette/command-palette-store';
import { API_BASE_URL, OTEL_TRACES_URL } from '#app/lib/config';
import { DevicePreferencesProvider } from '#app/lib/preferences/device-preferences-provider';
import { urlModals } from '#app/lib/url-modal/registry';

const VITALS_ENDPOINT = { path: recordWebVitals.path, maxBatchSize: MAX_WEB_VITALS_PER_BATCH };

const { UrlModal } = urlModals;

const rootRoute = getRouteApi('__root__');

export function AppLayout() {
  const { api, toaster, sidebarState, auth, devicePreferences } = rootRoute.useRouteContext();
  const { identity, prefixed } = useTabIdentity();
  const [mergeState] = useState(createMergeState);
  useSessionSync();

  useWebTelemetry({
    app: 'web',
    serviceName: 'taitube-web',
    apiBaseUrl: API_BASE_URL,
    vitals: VITALS_ENDPOINT,
    tracesUrl: OTEL_TRACES_URL,
  });

  return (
    <>
      <ApiProvider api={api}>
        <MergeStateContext value={mergeState}>
          <DevicePreferencesProvider initial={devicePreferences}>
            <SessionProvider session={auth} identity={identity} prefixed={prefixed}>
              <ChannelPermissions>
                <UserEventStream>
                  <Tooltip.Provider>
                    <ToastProvider toaster={toaster}>
                      <PreferencesSync>
                        <PlaybackSessionProvider>
                          <CommandPaletteProvider>
                            <AmbientGlowProvider>
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
                                    <UrlModal.WhenOpened id="sign-in">
                                      <LazySignInDialog />
                                    </UrlModal.WhenOpened>
                                    <ReplayIntent />
                                    <UrlModal.WhenOpened id="new-playlist">
                                      <LazyNewPlaylistDialog />
                                    </UrlModal.WhenOpened>
                                    <UpdatePrompt />
                                    <QueuedChangesSync />
                                  </>
                                }
                              />
                            </AmbientGlowProvider>
                          </CommandPaletteProvider>
                        </PlaybackSessionProvider>
                      </PreferencesSync>
                    </ToastProvider>
                  </Tooltip.Provider>
                </UserEventStream>
              </ChannelPermissions>
            </SessionProvider>
          </DevicePreferencesProvider>
        </MergeStateContext>
      </ApiProvider>
      <Suspense>
        <LazyDevtools />
      </Suspense>
    </>
  );
}
