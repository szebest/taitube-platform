import { ToastProvider, Tooltip } from '@kit/ui';
import { useWebTelemetry } from '@kit/web-telemetry';
import { getRouteApi } from '@tanstack/react-router';
import {
  ApiProvider,
  IdentitySwitcherProvider,
  OpenAsLinks,
  SessionProvider,
  UserEventStream,
  useSessionSync,
  useTabIdentity,
  WhenSwitcherOpened,
} from '@vp/queries';
import { Suspense, useState } from 'react';
import { webComposition } from '#app/composition/registry';
import {
  AccountMenu,
  ChannelPermissions,
  createMergeState,
  LazyIdentitySwitcherSheet,
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
import { ImpressionsProvider } from '#app/integrations/impressions/impressions-provider';
import { AmbientGlowProvider } from '#app/lib/ambient/ambient-glow';
import { CommandPaletteProvider } from '#app/lib/command-palette/command-palette-store';
import { DevicePreferencesProvider } from '#app/lib/preferences/device-preferences-provider';
import { urlModals } from '#app/lib/url-modal/registry';

const { UrlModal } = urlModals;

const rootRoute = getRouteApi('__root__');

export function AppLayout() {
  const { api, toaster, sidebarState, auth, devicePreferences } = rootRoute.useRouteContext();
  const { identity, prefixed } = useTabIdentity();
  const [mergeState] = useState(createMergeState);
  useSessionSync();

  useWebTelemetry(webComposition.telemetry);

  return (
    <>
      <ApiProvider api={api}>
        <MergeStateContext value={mergeState}>
          <DevicePreferencesProvider initial={devicePreferences}>
            <IdentitySwitcherProvider fallback="/">
              <SessionProvider session={auth} identity={identity} prefixed={prefixed}>
                <ChannelPermissions>
                  <UserEventStream>
                    <Tooltip.Provider>
                      <ToastProvider toaster={toaster}>
                        <PreferencesSync>
                          <PlaybackSessionProvider>
                            <CommandPaletteProvider>
                              <AmbientGlowProvider>
                                <OpenAsLinks>
                                  <ImpressionsProvider>
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
                                          <WhenSwitcherOpened>
                                            <LazyIdentitySwitcherSheet />
                                          </WhenSwitcherOpened>
                                        </>
                                      }
                                    />
                                  </ImpressionsProvider>
                                </OpenAsLinks>
                              </AmbientGlowProvider>
                            </CommandPaletteProvider>
                          </PlaybackSessionProvider>
                        </PreferencesSync>
                      </ToastProvider>
                    </Tooltip.Provider>
                  </UserEventStream>
                </ChannelPermissions>
              </SessionProvider>
            </IdentitySwitcherProvider>
          </DevicePreferencesProvider>
        </MergeStateContext>
      </ApiProvider>
      <Suspense>
        <LazyDevtools />
      </Suspense>
    </>
  );
}
