import {
  HeadContent,
  ScriptOnce,
  Scripts,
  createRootRouteWithContext,
} from '@tanstack/react-router';
import { IntlProvider } from '@vp/intl-react';
import { ApiProvider, AuthProvider } from '@vp/queries';
import {
  SYSTEM_THEME_SCRIPT,
  ThemeProvider,
  ToastProvider,
  TooltipProvider,
  requestThemePreference,
  useTheme,
} from '@vp/ui';
import bootstrap from 'bootstrap/dist/css/bootstrap.min.css?url';
import type { ReactNode } from 'react';
import { z } from 'zod';

import designSystem from '@vp/ui/design-system.css?url';
import { StudioShell } from '#app/layout/studio-shell';
import type { RouterContext } from '#app/router';
import appStyles from '#app/studio.css?url';

export const Route = createRootRouteWithContext<RouterContext>()({
  validateSearch: z.object({}),
  beforeLoad: () => ({ themePreference: requestThemePreference() }),
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
    <ThemeProvider preference={themePreference}>
      <ThemedDocument>{children}</ThemedDocument>
    </ThemeProvider>
  );
}

function ThemedDocument({ children }: { children: ReactNode }) {
  const { preference, theme } = useTheme();

  return (
    <html lang="en" data-theme={theme} suppressHydrationWarning>
      <head>
        <HeadContent />
        {preference === 'system' && <ScriptOnce>{SYSTEM_THEME_SCRIPT}</ScriptOnce>}
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootLayout() {
  const { api, toaster } = Route.useRouteContext();

  return (
    <IntlProvider locale="en" timeZone="UTC">
      <ApiProvider api={api}>
        <AuthProvider>
          <TooltipProvider>
            <ToastProvider toaster={toaster} closeLabel="Dismiss">
              <StudioShell />
            </ToastProvider>
          </TooltipProvider>
        </AuthProvider>
      </ApiProvider>
    </IntlProvider>
  );
}
