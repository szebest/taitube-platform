import {
  HeadContent,
  ScriptOnce,
  Scripts,
  createRootRouteWithContext,
  useMatches,
} from '@tanstack/react-router';
import { IntlProvider } from '@vp/intl-react';
import bootstrapIcons from 'bootstrap-icons/font/bootstrap-icons.min.css?url';
import bootstrap from 'bootstrap/dist/css/bootstrap.min.css?url';
import { type ReactNode, Suspense, lazy } from 'react';
import { ToastContainer } from 'react-toastify';
import { z } from 'zod';

import designSystem from '#app/components/ui/design-system.css?url';
import { SYSTEM_THEME_SCRIPT } from '#app/components/ui/theme/system-theme';
import { requestThemePreference } from '#app/components/ui/theme/theme-preference';
import { ThemeProvider, useTheme } from '#app/components/ui/theme/theme-provider';
import { ToastProvider } from '#app/components/ui/toast';
import { TooltipProvider } from '#app/components/ui/tooltip';
import appStyles from '#app/index.scss?url';
import { DefaultLayout } from '#app/layout/containers';
import { AuthProvider, PermissionsProvider, SidebarProvider } from '#app/modules/shared/providers';
import type { RouterContext } from '#app/router';

const Devtools = import.meta.env.DEV
  ? lazy(() => import('#app/integrations/devtools/devtools'))
  : () => null;

export const Route = createRootRouteWithContext<RouterContext>()({
  validateSearch: z.object({}),
  beforeLoad: () => ({ themePreference: requestThemePreference() }),
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

function useLayoutMaxWidth(): string | undefined {
  return useMatches({
    select: (matches) => matches.findLast((match) => match.staticData.layoutMaxWidth),
  })?.staticData.layoutMaxWidth;
}

function RootLayout() {
  const maxWidth = useLayoutMaxWidth();
  const toaster = Route.useRouteContext({ select: (context) => context.toaster });

  return (
    <>
      <IntlProvider locale="en" timeZone="UTC">
        <AuthProvider>
          <PermissionsProvider>
            <SidebarProvider>
              <TooltipProvider>
                <ToastProvider toaster={toaster} closeLabel="Dismiss">
                  <DefaultLayout maxWidth={maxWidth} />
                  <ToastContainer limit={3} />
                </ToastProvider>
              </TooltipProvider>
            </SidebarProvider>
          </PermissionsProvider>
        </AuthProvider>
      </IntlProvider>
      <Suspense>
        <Devtools />
      </Suspense>
    </>
  );
}
