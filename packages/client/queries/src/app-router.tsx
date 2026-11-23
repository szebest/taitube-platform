import { requestNonce } from '@kit/security-headers';
import { createToaster, type Toaster } from '@kit/ui';
import type { QueryClient } from '@tanstack/react-query';
import {
  type AnyRoute,
  type RouteComponent,
  Router,
  type RouterHistory,
  useMatches,
} from '@tanstack/react-router';
import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query';
import type { ApiClient } from '@vp/api-client';
import { isSupportedLocale, type SharedCatalogue } from '@vp/messages';
import { type PropsWithChildren, useSyncExternalStore } from 'react';
import { type ActingChannelStore, createActingChannelStore } from './acting-channel';
import { createAppApiClient } from './api-client';
import { AppWords } from './app-words';
import { createQueryClient } from './create-query-client';
import { type AppMessages, createLocaleStore, type LocaleStore } from './intl';
import { RouteError, RouteNotFound } from './route-errors';
import { endSession } from './session-changes';

/** What every route reads from context; the root route's `beforeLoad` adds `auth` (`ensureSession`). */
export type AppRouterContext<App extends SharedCatalogue = SharedCatalogue> = {
  api: ApiClient;
  queryClient: QueryClient;
  toaster: Toaster;
  /** The negotiated locale and its loaded catalogue; the root route's `requestLocale` sets it. */
  locales: LocaleStore<App>;
  /** The channel a studio acts on; web never selects one, so its calls name none. */
  actingChannel: ActingChannelStore;
};

/** What a spec or a request hands the router in place of the defaults it would build. */
export type AppRouterOptions<App extends SharedCatalogue = SharedCatalogue> = Partial<
  AppRouterContext<App>
> & {
  history?: RouterHistory;
  nonce?: string;
  /** `false` switches intent preloading off, for a viewer who saves data. */
  defaultPreload?: 'intent' | false;
};

export type AppRoutes<TRouteTree extends AnyRoute, App extends SharedCatalogue> = {
  routeTree: TRouteTree;
  /** The app's catalogue, its translations and its translator provider. */
  messages: AppMessages<App>;
  /** Where the app's API client calls, from the app's own `src/config`. */
  apiBaseUrl: string;
  pending: RouteComponent;
  /** Sends the store's channel as `X-Channel-Id` on the calls that take one: the studio's. */
  actsOnChannels?: boolean;
};

function parseSearch(searchStr: string): Record<string, string> {
  return Object.fromEntries(new URLSearchParams(searchStr));
}

function stringifySearch(search: Record<string, unknown>): string {
  const present = Object.entries(search).filter(([, value]) => value !== undefined);
  const searchStr = new URLSearchParams(present.map(([key, value]) => [key, String(value)]));
  return searchStr.size > 0 ? `?${searchStr}` : '';
}

/** Every navigation cross-fades through a view transition; under reduced motion the page swaps at once. */
const viewTransition = {
  types: () => (document.documentElement.dataset.motion === 'reduced' ? false : ['navigation']),
};

function RouterWords<App extends SharedCatalogue>({
  messages,
  locales,
  renderedAt,
  children,
}: PropsWithChildren<{
  messages: AppMessages<App>;
  locales: LocaleStore<App>;
  renderedAt: string;
}>) {
  const active = useSyncExternalStore(locales.subscribe, locales.snapshot, locales.snapshot);

  return (
    <AppWords messages={messages} active={active} renderedAt={renderedAt}>
      {children}
    </AppWords>
  );
}

const PENDING_DELAY_MS = 1000;
const PENDING_MIN_MS = 500;

/**
 * A client app's router: one API client, query cache and toaster per router in context
 * (so no two requests share one), the request's CSP nonce on every script, preloading on intent, a
 * pending page that waits before it shows and then stays long enough not to flash, and the query
 * cache, the server's render instant and its negotiated locale dehydrated into the page (the
 * browser loads that locale's catalogue before it hydrates, so it renders the words the server
 * wrote). Search params stay the text the URL carries (no JSON either way), so `?q=1.10` is
 * `'1.10'` and each route's schema coerces what it needs.
 */
export function createAppRouter<TRouteTree extends AnyRoute, App extends SharedCatalogue>(
  { routeTree, messages, apiBaseUrl, pending, actsOnChannels = false }: AppRoutes<TRouteTree, App>,
  {
    history,
    api,
    queryClient = createQueryClient(),
    toaster = createToaster(),
    locales = createLocaleStore(messages),
    actingChannel = createActingChannelStore(),
    nonce = requestNonce(),
    defaultPreload = 'intent',
  }: AppRouterOptions<App> = {}
): Router<TRouteTree> {
  let renderedAt = new Date().toISOString();
  const sessionApi = () =>
    createAppApiClient({
      apiBaseUrl,
      onUnauthorized: () => endSession(router),
      getChannelId: actsOnChannels ? actingChannel.read : undefined,
    });
  // Named as `Router`, not `createRouter`'s `RouterCore`, so the emitted declaration imports a
  // package the apps resolve: `@tanstack/router-core` is react-router's own dependency, not theirs.
  const router: Router<TRouteTree> = new Router({
    routeTree,
    history,
    ssr: { nonce },
    context: {
      api: api ?? sessionApi(),
      queryClient,
      toaster,
      locales,
      actingChannel,
    } satisfies AppRouterContext<App>,
    defaultPreload,
    defaultPreloadStaleTime: 0,
    defaultViewTransition: viewTransition,
    defaultPendingMs: PENDING_DELAY_MS,
    defaultPendingMinMs: PENDING_MIN_MS,
    defaultPendingComponent: pending,
    defaultErrorComponent: RouteError,
    defaultNotFoundComponent: RouteNotFound,
    scrollRestoration: true,
    Wrap: ({ children }) => (
      <RouterWords messages={messages} locales={locales} renderedAt={renderedAt}>
        {children}
      </RouterWords>
    ),
    dehydrate: (): Record<string, string> => ({
      renderedAt,
      locale: locales.snapshot().locale,
      actingChannel: actingChannel.read() ?? '',
    }),
    hydrate: async (dehydrated) => {
      renderedAt = dehydrated['renderedAt'] ?? renderedAt;
      actingChannel.select(dehydrated['actingChannel'] || undefined);
      const locale = dehydrated['locale'] ?? '';
      if (isSupportedLocale(locale)) {
        await locales.activate(locale);
      }
    },
    parseSearch,
    stringifySearch,
  });
  setupRouterSsrQueryIntegration({ router, queryClient });
  return router;
}

/** The width the deepest matched route asks of the layout, from its `staticData.layoutMaxWidth`. */
export function useLayoutMaxWidth(): string | undefined {
  return useMatches({
    select: (matches) => matches.findLast((match) => match.staticData.layoutMaxWidth),
  })?.staticData.layoutMaxWidth;
}

declare module '@tanstack/react-router' {
  interface StaticDataRouteOption {
    layoutMaxWidth?: string;
  }
}
