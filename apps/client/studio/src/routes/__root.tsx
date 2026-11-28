import { requestAppearancePreference, ThemedDocument, ToastProvider, Tooltip } from '@kit/ui';
import uiStyles from '@kit/ui/styles.css?url';
import { useWebTelemetry } from '@kit/web-telemetry';
import { createRootRouteWithContext } from '@tanstack/react-router';
import {
  ApiProvider,
  type AppRouterContext,
  ensureSession,
  IdentitySwitcherProvider,
  requestLocale,
  SessionProvider,
  UserEventStream,
  useSessionSync,
  useTabIdentity,
} from '@vp/queries';
import type { ReactNode } from 'react';
import { studioComposition } from '#app/composition/registry';
import type { StudioCatalogue } from '#app/lib/messages';
import { AccessDeniedSearchSchema } from '#app/utils/access-denied-search';
import { StudioRoot } from './-components/studio-root/studio-root';

export const Route = createRootRouteWithContext<AppRouterContext<StudioCatalogue>>()({
  validateSearch: AccessDeniedSearchSchema,
  beforeLoad: async ({ context, location }) => ({
    appearance: requestAppearancePreference(studioComposition.appearanceCookies),
    ...(await requestLocale(context.locales, { searchStr: location.searchStr })),
    auth: await ensureSession(context),
  }),
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
      { name: 'robots', content: 'noindex, nofollow' },
      { title: 'Taitube Studio' },
    ],
    links: [
      { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
      { rel: 'icon', href: '/favicon.ico', sizes: '48x48' },
      { rel: 'stylesheet', href: uiStyles },
    ],
  }),
  shellComponent: RootDocument,
  component: RootLayout,
});

function RootDocument({ children }: { children: ReactNode }) {
  const { appearance, locale, direction } = Route.useRouteContext();

  return (
    <ThemedDocument
      stored={appearance}
      defaults={studioComposition.tokenSetDefaults}
      lang={locale}
      dir={direction}
      cookieDomain={studioComposition.cookieDomain}
    >
      {children}
    </ThemedDocument>
  );
}

function RootLayout() {
  const { api, toaster, auth } = Route.useRouteContext();
  const { identity, prefixed } = useTabIdentity();
  useSessionSync();

  useWebTelemetry(studioComposition.telemetry);

  return (
    <ApiProvider api={api}>
      <IdentitySwitcherProvider fallback="/">
        <SessionProvider session={auth} identity={identity} prefixed={prefixed}>
          <UserEventStream>
            <Tooltip.Provider>
              <ToastProvider toaster={toaster}>
                <StudioRoot />
              </ToastProvider>
            </Tooltip.Provider>
          </UserEventStream>
        </SessionProvider>
      </IdentitySwitcherProvider>
    </ApiProvider>
  );
}
