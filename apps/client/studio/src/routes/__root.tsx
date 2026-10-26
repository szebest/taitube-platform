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
  type TokenSetIds,
  ToastProvider,
  Tooltip,
  requestAppearancePreference,
} from '@vp/ui';
import { useWebTelemetry } from '@vp/web-telemetry';
import bootstrap from 'bootstrap/dist/css/bootstrap.min.css?url';
import type { ReactNode } from 'react';

import uiStyles from '@vp/ui/styles.css?url';
import { API_BASE_URL, COOKIE_DOMAIN, OTEL_TRACES_URL } from '#app/config';
import { StudioShell } from '#app/layout/studio-shell';
import appStyles from '#app/studio.css?url';

/** The studio is a dense workspace: it starts on compact spacing and small sizing. */
const STUDIO_SETS: TokenSetIds = { spacing: 'compact', sizing: 'small' };

export const Route = createRootRouteWithContext<AppRouterContext>()({
  beforeLoad: async ({ context }) => ({
    appearance: requestAppearancePreference(),
    auth: await ensureSession(context),
  }),
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { name: 'robots', content: 'noindex, nofollow' },
      { title: 'Taitube Studio' },
    ],
    links: [
      { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
      { rel: 'icon', href: '/favicon.ico', sizes: '48x48' },
      { rel: 'stylesheet', href: bootstrap },
      { rel: 'stylesheet', href: uiStyles },
      { rel: 'stylesheet', href: appStyles },
    ],
  }),
  shellComponent: RootDocument,
  component: RootLayout,
});

function RootDocument({ children }: { children: ReactNode }) {
  const appearance = Route.useRouteContext({ select: (context) => context.appearance });

  return (
    <ThemedDocument stored={appearance} defaults={STUDIO_SETS} cookieDomain={COOKIE_DOMAIN}>
      {children}
    </ThemedDocument>
  );
}

function RootLayout() {
  const { api, toaster, auth } = Route.useRouteContext();

  useWebTelemetry({ app: 'studio', apiBaseUrl: API_BASE_URL, tracesUrl: OTEL_TRACES_URL });

  return (
    <ApiProvider api={api}>
      <SessionProvider session={auth}>
        <UserEventStream>
          <Tooltip.Provider>
            <ToastProvider toaster={toaster}>
              <StudioShell />
            </ToastProvider>
          </Tooltip.Provider>
        </UserEventStream>
      </SessionProvider>
    </ApiProvider>
  );
}
