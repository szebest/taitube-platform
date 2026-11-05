import { createRootRouteWithContext, Outlet, useRouterState } from '@tanstack/react-router';
import {
  ApiProvider,
  type AppRouterContext,
  ensureSession,
  requestLocale,
  SessionProvider,
  UserEventStream,
} from '@vp/queries';
import { requestAppearancePreference, ThemedDocument, ToastProvider, Tooltip } from '@vp/ui';
import uiStyles from '@vp/ui/styles.css?url';
import { useWebTelemetry } from '@vp/web-telemetry';
import { lazy, type ReactNode, Suspense } from 'react';
import { AppShellSkeleton } from '#app/components/shell/app-shell';
import { API_BASE_URL, COOKIE_DOMAIN, OTEL_TRACES_URL } from '#app/config';
import { isEmbedPath } from '#app/features/embed/embed-path';
import { ThemeColorMeta } from '#app/features/pwa/theme-color-meta';
import { headWords } from '#app/features/seo/head-words';
import { PreferencesSync } from '#app/features/settings/components/preferences-sync';
import { requestDevicePreferences } from '#app/features/settings/device/device-preferences';
import { DevicePreferencesProvider } from '#app/features/settings/device/device-preferences-provider';
import { RootShell } from '#app/features/shell/components/root-shell';
import { requestSidebarState } from '#app/features/shell/sidebar-state';
import { urlModals } from '#app/features/url-modal/registry';

const Devtools = import.meta.env.DEV
  ? lazy(() => import('#app/integrations/devtools/devtools'))
  : () => null;

export const Route = createRootRouteWithContext<AppRouterContext>()({
  beforeLoad: async ({ context, location }) => {
    const devicePreferences = requestDevicePreferences();
    return {
      appearance: requestAppearancePreference(),
      devicePreferences,
      sidebarState: requestSidebarState(),
      ...(await requestLocale(context.locales, {
        searchStr: location.searchStr,
        persisted: devicePreferences.locale,
      })),
      auth: await ensureSession(context),
    };
  },
  head: ({ match }) => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      {
        name: 'description',
        content: headWords(match.context.locales.snapshot()).tOr('shell.siteDescription', {}, ''),
      },
      { title: 'Taitube' },
    ],
    links: [
      { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
      { rel: 'icon', href: '/favicon.ico', sizes: '48x48' },
      { rel: 'apple-touch-icon', href: '/logo192.png' },
      { rel: 'manifest', href: '/manifest.webmanifest' },
      { rel: 'stylesheet', href: uiStyles },
    ],
  }),
  validateSearch: urlModals.searchSchema,
  search: { middlewares: [urlModals.retainUrlModal] },
  shellComponent: RootDocument,
  pendingComponent: AppShellSkeleton,
  component: RootLayout,
});

function RootDocument({ children }: { children: ReactNode }) {
  const { appearance, locale, direction } = Route.useRouteContext();

  return (
    <ThemedDocument stored={appearance} lang={locale} dir={direction} cookieDomain={COOKIE_DOMAIN}>
      <ThemeColorMeta />
      {children}
    </ThemedDocument>
  );
}

function RootLayout() {
  const embedded = useRouterState({ select: ({ location }) => isEmbedPath(location.pathname) });

  return embedded ? <EmbedLayout /> : <AppLayout />;
}

/** A third-party page frames this: the player and the API client it reads from, nothing of the app. */
function EmbedLayout() {
  const { api } = Route.useRouteContext();

  return (
    <ApiProvider api={api}>
      <Tooltip.Provider>
        <Outlet />
      </Tooltip.Provider>
    </ApiProvider>
  );
}

function AppLayout() {
  const { api, toaster, sidebarState, auth, devicePreferences } = Route.useRouteContext();

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
                    <RootShell sidebar={sidebarState} />
                  </PreferencesSync>
                </DevicePreferencesProvider>
              </ToastProvider>
            </Tooltip.Provider>
          </UserEventStream>
        </SessionProvider>
      </ApiProvider>
      <Suspense>
        <Devtools />
      </Suspense>
    </>
  );
}
