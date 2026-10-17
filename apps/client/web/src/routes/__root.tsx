import { createRootRouteWithContext } from '@tanstack/react-router';
import { IntlProvider } from '@vp/intl-react';
import {
  ApiProvider,
  type AppRouterContext,
  SessionProvider,
  ensureSession,
  useLayoutMaxWidth,
} from '@vp/queries';
import { ThemedDocument, ToastProvider, TooltipProvider, requestThemePreference } from '@vp/ui';
import { useWebTelemetry } from '@vp/web-telemetry';
import bootstrapIcons from 'bootstrap-icons/font/bootstrap-icons.min.css?url';
import bootstrap from 'bootstrap/dist/css/bootstrap.min.css?url';
import { type ReactNode, Suspense, lazy } from 'react';
import { ToastContainer } from 'react-toastify';

import designSystem from '@vp/ui/design-system.css?url';
import { API_BASE_URL, COOKIE_DOMAIN, OTEL_TRACES_URL } from '#app/config';
import appStyles from '#app/index.scss?url';
import { DefaultLayout } from '#app/layout/containers';
import { SidebarProvider } from '#app/modules/shared/providers';

const Devtools = import.meta.env.DEV
  ? lazy(() => import('#app/integrations/devtools/devtools'))
  : () => null;

export const Route = createRootRouteWithContext<AppRouterContext>()({
  beforeLoad: async ({ context }) => ({
    themePreference: requestThemePreference(),
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
      { rel: 'stylesheet', href: designSystem },
    ],
  }),
  shellComponent: RootDocument,
  component: RootLayout,
});

function RootDocument({ children }: { children: ReactNode }) {
  const themePreference = Route.useRouteContext({ select: (context) => context.themePreference });

  return (
    <ThemedDocument preference={themePreference} cookieDomain={COOKIE_DOMAIN}>
      {children}
    </ThemedDocument>
  );
}

function RootLayout() {
  const maxWidth = useLayoutMaxWidth();
  const { api, toaster, auth } = Route.useRouteContext();

  useWebTelemetry({ app: 'web', apiBaseUrl: API_BASE_URL, tracesUrl: OTEL_TRACES_URL });

  return (
    <>
      <IntlProvider locale="en" timeZone="UTC">
        <ApiProvider api={api}>
          <SessionProvider session={auth}>
            <SidebarProvider>
              <TooltipProvider>
                <ToastProvider toaster={toaster} closeLabel="Dismiss">
                  <DefaultLayout maxWidth={maxWidth} />
                  <ToastContainer limit={3} closeOnClick draggable />
                </ToastProvider>
              </TooltipProvider>
            </SidebarProvider>
          </SessionProvider>
        </ApiProvider>
      </IntlProvider>
      <Suspense>
        <Devtools />
      </Suspense>
    </>
  );
}
