import { createRootRouteWithContext, useRouterState } from '@tanstack/react-router';
import { type AppRouterContext, ensureSession, requestLocale } from '@vp/queries';
import { requestAppearancePreference } from '@vp/ui';
import uiStyles from '@vp/ui/styles.css?url';
import { AppShellSkeleton } from '#app/components/shell/app-shell';
import { isEmbedPath } from '#app/features/embed';
import { requestSidebarState } from '#app/features/shell';
import { requestDevicePreferences } from '#app/lib/preferences/device-preferences';
import { headWords } from '#app/lib/seo/head-words';
import { urlModals } from '#app/lib/url-modal/registry';
import { AppLayout } from './-components/app-layout/app-layout';
import { EmbedLayout } from './-components/embed-layout/embed-layout';
import { RootDocument } from './-components/root-document/root-document';

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

function RootLayout() {
  const embedded = useRouterState({ select: ({ location }) => isEmbedPath(location.pathname) });

  return embedded ? <EmbedLayout /> : <AppLayout />;
}
