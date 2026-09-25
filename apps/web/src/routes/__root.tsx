import { ApiProvider } from '@reduxjs/toolkit/query/react';
import {
  HeadContent,
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

import { baseApi } from '#app/base-api';
import { DEVTOOLS_ENABLED } from '#app/config';
import appStyles from '#app/index.scss?url';
import { DefaultLayout } from '#app/layout/containers';
import {
  AuthProvider,
  PermissionsProvider,
  SidebarProvider,
  ThemeProvider,
} from '#app/modules/shared/providers';
import type { RouterContext } from '#app/router';

const Devtools = DEVTOOLS_ENABLED
  ? lazy(() => import('#app/integrations/devtools/devtools'))
  : () => null;

export const Route = createRootRouteWithContext<RouterContext>()({
  validateSearch: z.object({}),
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
    ],
  }),
  shellComponent: RootDocument,
  component: RootLayout,
});

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
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

  return (
    <ApiProvider api={baseApi}>
      <IntlProvider locale="en" timeZone="UTC">
        <AuthProvider>
          <PermissionsProvider>
            <SidebarProvider>
              <ThemeProvider>
                <DefaultLayout maxWidth={maxWidth} />
                <ToastContainer limit={3} />
              </ThemeProvider>
            </SidebarProvider>
          </PermissionsProvider>
        </AuthProvider>
      </IntlProvider>
      <Suspense>
        <Devtools />
      </Suspense>
    </ApiProvider>
  );
}
