import { createLocaleStore, type LocaleStore } from '@kit/intl-react';
import { tryCatch, unwrapOr } from '@kit/result';
import { requestNonce } from '@kit/security-headers';
import { createToaster, type Toaster } from '@kit/ui';
import { type QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  type AnyRoute,
  type RouteComponent,
  Router,
  type RouterHistory,
  useMatches,
} from '@tanstack/react-router';
import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query';
import { createIsomorphicFn } from '@tanstack/react-start';
import type { ApiClient } from '@vp/api-client';
import { isSupportedLocale } from '@vp/messages';
import { type PropsWithChildren, useSyncExternalStore } from 'react';
import { identityPath, parseIdentityPath } from './account-slots';
import { type ActingChannelStore, createActingChannelStore } from './acting-channel';
import { createAppApiClient } from './api-client';
import { AppWords } from './app-words';
import {
  type IdentityState,
  type IdentityStore,
  createIdentityStore,
  parseIdentityState,
} from './identity-store';
import { resolveRequestIdentity } from './request-identity';
import { RouteError, RouteNotFound } from './route-errors';
import { SESSION_KEY, type Session } from './session';
import { endSession } from './session-changes';

/** What every route reads from context; the root route's `beforeLoad` adds `auth` (`ensureSession`). */
export type AppRouterContext = {
  api: ApiClient;
  queryClient: QueryClient;
  toaster: Toaster;
  /** The negotiated locale and its loaded catalogue; the root route's `requestLocale` sets it. */
  locales: LocaleStore;
  /** The channel a studio acts on; web never selects one, so its calls name none. */
  actingChannel: ActingChannelStore;
  /** The account slot and channel this tab acts as, and the query cache that is theirs. */
  identity: IdentityStore;
  /** A client calling as another slot, for what the switcher fetches ahead of a switch to it. */
  apiAs: (slot: number) => ApiClient;
};

/** What a spec or a request hands the router in place of the defaults it would build. */
export type AppRouterOptions = Partial<AppRouterContext> & {
  history?: RouterHistory;
  nonce?: string;
  /** `false` switches intent preloading off, for a viewer who saves data. */
  defaultPreload?: 'intent' | false;
};

export type AppRoutes<TRouteTree extends AnyRoute> = {
  routeTree: TRouteTree;
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

const SIGNED_OUT_IDENTITY: IdentityState = { identity: { slot: 0 }, prefixed: false };

/** The identity the server resolved for the request, or in the browser the one its URL names until the page hydrates. */
const initialIdentity = createIsomorphicFn()
  .server((_history: RouterHistory | undefined): IdentityState => {
    const resolved = tryCatch(
      (): IdentityState => {
        const { identity, prefixed } = resolveRequestIdentity();
        return { identity, prefixed };
      },
      (cause) => cause
    );
    return unwrapOr(resolved, SIGNED_OUT_IDENTITY);
  })
  .client((history: RouterHistory | undefined): IdentityState => {
    const { identity } = parseIdentityPath((history?.location ?? window.location).pathname);
    return identity ? { identity, prefixed: true } : SIGNED_OUT_IDENTITY;
  });

function IdentityQueryClient({
  identity,
  children,
}: PropsWithChildren<{ identity: IdentityStore }>) {
  const client = useSyncExternalStore(
    identity.subscribe,
    identity.queryClient,
    identity.queryClient
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

/** Every navigation cross-fades through a view transition; under reduced motion the page swaps at once. */
const viewTransition = {
  types: () => (document.documentElement.dataset.motion === 'reduced' ? false : ['navigation']),
};

function RouterWords({
  locales,
  renderedAt,
  children,
}: PropsWithChildren<{ locales: LocaleStore; renderedAt: string }>) {
  const active = useSyncExternalStore(locales.subscribe, locales.snapshot, locales.snapshot);

  return (
    <AppWords active={active} renderedAt={renderedAt}>
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
export function createAppRouter<TRouteTree extends AnyRoute>(
  { routeTree, apiBaseUrl, pending, actsOnChannels = false }: AppRoutes<TRouteTree>,
  {
    history,
    api,
    queryClient,
    toaster = createToaster(),
    locales = createLocaleStore(),
    actingChannel = createActingChannelStore(),
    identity = createIdentityStore(initialIdentity(history), queryClient),
    apiAs = (slot) =>
      createAppApiClient({ apiBaseUrl, getSlot: () => slot, onUnauthorized: () => undefined }),
    nonce = requestNonce(),
    defaultPreload = 'intent',
  }: AppRouterOptions = {}
): Router<TRouteTree> {
  let renderedAt = new Date().toISOString();
  const actingChannelId = () => {
    const named = identity.queryClient().getQueryData<Session>(SESSION_KEY)?.actingChannelId;
    return named ?? (actsOnChannels ? actingChannel.read() : undefined);
  };
  const sessionApi = () =>
    createAppApiClient({
      apiBaseUrl,
      getSlot: () => identity.read().identity.slot,
      onUnauthorized: (slot) => endSession(router, slot),
      getChannelId: actingChannelId,
    });
  // Named as `Router`, not `createRouter`'s `RouterCore`, so the emitted declaration imports a
  // package the apps resolve: `@tanstack/router-core` is react-router's own dependency, not theirs.
  const router: Router<TRouteTree> = new Router({
    routeTree,
    history,
    ssr: { nonce },
    context: {
      api: api ?? sessionApi(),
      queryClient: identity.queryClient(),
      toaster,
      locales,
      actingChannel,
      identity,
      apiAs,
    } satisfies AppRouterContext,
    rewrite: {
      input: ({ url }) => {
        const located = parseIdentityPath(url.pathname);
        if (!located.identity) return undefined;
        url.pathname = located.pathname;
        return url;
      },
      output: ({ url }) => {
        const { identity: current, prefixed } = identity.read();
        if (!prefixed) return undefined;
        url.pathname = identityPath(current, url.pathname);
        return url;
      },
    },
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
      <IdentityQueryClient identity={identity}>
        <RouterWords locales={locales} renderedAt={renderedAt}>
          {children}
        </RouterWords>
      </IdentityQueryClient>
    ),
    dehydrate: (): Record<string, string> => ({
      renderedAt,
      locale: locales.snapshot().locale,
      actingChannel: actingChannel.read() ?? '',
      identity: JSON.stringify(identity.read()),
    }),
    hydrate: async (dehydrated) => {
      renderedAt = dehydrated['renderedAt'] ?? renderedAt;
      actingChannel.select(dehydrated['actingChannel'] || undefined);
      identity.hydrate(parseIdentityState(dehydrated['identity']) ?? identity.read());
      const locale = dehydrated['locale'] ?? '';
      if (isSupportedLocale(locale)) {
        await locales.activate(locale);
      }
    },
    parseSearch,
    stringifySearch,
  });
  setupRouterSsrQueryIntegration({
    router,
    queryClient: identity.queryClient(),
    wrapQueryClient: false,
  });
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
