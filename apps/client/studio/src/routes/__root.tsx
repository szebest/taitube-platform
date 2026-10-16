import { createRootRouteWithContext } from '@tanstack/react-router';
import { IntlProvider } from '@vp/intl-react';
import { ApiProvider, type AppRouterContext, SessionProvider, ensureSession } from '@vp/queries';
import { ThemedDocument, ToastProvider, TooltipProvider, requestThemePreference } from '@vp/ui';
import bootstrap from 'bootstrap/dist/css/bootstrap.min.css?url';
import type { ReactNode } from 'react';

import designSystem from '@vp/ui/design-system.css?url';
import { COOKIE_DOMAIN } from '#app/config';
import { StudioShell } from '#app/layout/studio-shell';
import appStyles from '#app/studio.css?url';

export const Route = createRootRouteWithContext<AppRouterContext>()({
  beforeLoad: async ({ context }) => ({
    themePreference: requestThemePreference(),
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
      { rel: 'icon', href: '/favicon.ico' },
      { rel: 'stylesheet', href: bootstrap },
      { rel: 'stylesheet', href: designSystem },
      { rel: 'stylesheet', href: appStyles },
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
  const { api, toaster, auth } = Route.useRouteContext();

  return (
    <IntlProvider locale="en" timeZone="UTC">
      <ApiProvider api={api}>
        <SessionProvider session={auth}>
          <TooltipProvider>
            <ToastProvider toaster={toaster} closeLabel="Dismiss">
              <StudioShell />
            </ToastProvider>
          </TooltipProvider>
        </SessionProvider>
      </ApiProvider>
    </IntlProvider>
  );
}
