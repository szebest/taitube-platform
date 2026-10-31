import { createRootRouteWithContext } from '@tanstack/react-router';
import {
  ApiProvider,
  type AppRouterContext,
  ensureSession,
  SessionProvider,
  UserEventStream,
} from '@vp/queries';
import { requestAppearancePreference, ThemedDocument, ToastProvider, Tooltip } from '@vp/ui';
import uiStyles from '@vp/ui/styles.css?url';
import { useWebTelemetry } from '@vp/web-telemetry';
import bootstrap from 'bootstrap/dist/css/bootstrap.min.css?url';
import bootstrapIcons from 'bootstrap-icons/font/bootstrap-icons.min.css?url';
import { lazy, type ReactNode, Suspense } from 'react';
import { ToastContainer } from 'react-toastify';
import { AppShellSkeleton } from '#app/components/shell/app-shell';
import { API_BASE_URL, COOKIE_DOMAIN, OTEL_TRACES_URL } from '#app/config';
import { PreferencesSync } from '#app/features/settings/components/preferences-sync';
import { requestDevicePreferences } from '#app/features/settings/device/device-preferences';
import { DevicePreferencesProvider } from '#app/features/settings/device/device-preferences-provider';
import { RootShell } from '#app/features/shell/components/root-shell';
import { requestSidebarState } from '#app/features/shell/sidebar-state';
import { urlModals } from '#app/features/url-modal/registry';
import appStyles from '#app/index.scss?url';

const Devtools = import.meta.env.DEV
  ? lazy(() => import('#app/integrations/devtools/devtools'))
  : () => null;

export const Route = createRootRouteWithContext<AppRouterContext>()({
  beforeLoad: async ({ context }) => ({
    appearance: requestAppearancePreference(),
    devicePreferences: requestDevicePreferences(),
    sidebarState: requestSidebarState(),
    auth: await ensureSession(context),
  }),
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { name: 'description', content: 'Share videos with others online!' },
      { title: 'Taitube' },
    ],
    links: [
      { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
      { rel: 'icon', href: '/favicon.ico', sizes: '48x48' },
      { rel: 'apple-touch-icon', href: '/logo192.png' },
      { rel: 'stylesheet', href: bootstrap },
      { rel: 'stylesheet', href: bootstrapIcons },
      { rel: 'stylesheet', href: appStyles },
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
  const appearance = Route.useRouteContext({ select: (context) => context.appearance });

  return (
    <ThemedDocument stored={appearance} cookieDomain={COOKIE_DOMAIN}>
      {children}
    </ThemedDocument>
  );
}

function RootLayout() {
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
                    <ToastContainer limit={3} closeOnClick draggable />
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
