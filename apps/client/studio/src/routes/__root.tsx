import {
  requestAppearancePreference,
  ThemedDocument,
  ToastProvider,
  type TokenSetIds,
  Tooltip,
} from '@kit/ui';
import uiStyles from '@kit/ui/styles.css?url';
import { useWebTelemetry } from '@kit/web-telemetry';
import { createRootRouteWithContext } from '@tanstack/react-router';
import { MAX_WEB_VITALS_PER_BATCH, recordWebVitals } from '@vp/api-contracts';
import { APPEARANCE_COOKIES } from '@vp/domain/settings';
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
import { API_BASE_URL, COOKIE_DOMAIN, OTEL_TRACES_URL } from '#app/lib/config';
import { AccessDeniedSearchSchema } from '#app/utils/access-denied-search';
import { StudioRoot } from './-components/studio-root/studio-root';

/** The studio is a dense workspace: it starts on compact spacing and small sizing. */
const STUDIO_SETS: TokenSetIds = { spacing: 'compact', sizing: 'small' };

const VITALS_ENDPOINT = { path: recordWebVitals.path, maxBatchSize: MAX_WEB_VITALS_PER_BATCH };

export const Route = createRootRouteWithContext<AppRouterContext>()({
  validateSearch: AccessDeniedSearchSchema,
  beforeLoad: async ({ context, location }) => ({
    appearance: requestAppearancePreference(APPEARANCE_COOKIES),
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
      defaults={STUDIO_SETS}
      lang={locale}
      dir={direction}
      cookieDomain={COOKIE_DOMAIN}
    >
      {children}
    </ThemedDocument>
  );
}

function RootLayout() {
  const { api, toaster, auth } = Route.useRouteContext();
  const { identity, prefixed } = useTabIdentity();
  useSessionSync();

  useWebTelemetry({
    app: 'studio',
    serviceName: 'taitube-studio',
    apiBaseUrl: API_BASE_URL,
    vitals: VITALS_ENDPOINT,
    tracesUrl: OTEL_TRACES_URL,
  });

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
