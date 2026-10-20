import { createRootRouteWithContext } from '@tanstack/react-router';
import {
  ApiProvider,
  type AppRouterContext,
  SessionProvider,
  UserEventStream,
  ensureSession,
} from '@vp/queries';
import {
  ThemedDocument,
  ToastProvider,
  TooltipProvider,
  requestAppearancePreference,
} from '@vp/ui';
import { useWebTelemetry } from '@vp/web-telemetry';
import bootstrapIcons from 'bootstrap-icons/font/bootstrap-icons.min.css?url';
import bootstrap from 'bootstrap/dist/css/bootstrap.min.css?url';
import { type ReactNode, Suspense, lazy } from 'react';
import { ToastContainer } from 'react-toastify';

import uiStyles from '@vp/ui/styles.css?url';
import { API_BASE_URL, COOKIE_DOMAIN, OTEL_TRACES_URL } from '#app/config';
import appStyles from '#app/index.scss?url';
import { AppShell } from '#app/features/shell/components/app-shell/app-shell';
import { requestSidebarState } from '#app/features/shell/sidebar-state';

const Devtools = import.meta.env.DEV
  ? lazy(() => import('#app/integrations/devtools/devtools'))
  : () => null;

export const Route = createRootRouteWithContext<AppRouterContext>()({
  beforeLoad: async ({ context }) => ({
    appearance: requestAppearancePreference(),
    sidebarState: requestSidebarState(),
    auth: await ensureSession(context),
  }),
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { name: 'theme-color', content: '#000000' },
      { name: 'description', content: 'Share videos with others online!' },
      { title: 'Taitube' },
    ],
    links: [
      { rel: 'icon', href: '/favicon.ico' },
      { rel: 'apple-touch-icon', href: '/logo192.png' },
      { rel: 'stylesheet', href: bootstrap },
      { rel: 'stylesheet', href: bootstrapIcons },
      { rel: 'stylesheet', href: appStyles },
      { rel: 'stylesheet', href: uiStyles },
    ],
  }),
  shellComponent: RootDocument,
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
  const { api, toaster, sidebarState, auth } = Route.useRouteContext();

  useWebTelemetry({ app: 'web', apiBaseUrl: API_BASE_URL, tracesUrl: OTEL_TRACES_URL });

  return (
    <>
      <ApiProvider api={api}>
        <SessionProvider session={auth}>
          <UserEventStream>
            <TooltipProvider>
              <ToastProvider toaster={toaster}>
                <AppShell sidebar={sidebarState} />
                <ToastContainer limit={3} closeOnClick draggable />
              </ToastProvider>
            </TooltipProvider>
          </UserEventStream>
        </SessionProvider>
      </ApiProvider>
      <Suspense>
        <Devtools />
      </Suspense>
    </>
  );
}
