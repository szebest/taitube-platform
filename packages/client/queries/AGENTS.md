# AGENTS.md — @vp/queries (the data layer both client apps share)

> Tier rules for this directory: [../AGENTS.md](../AGENTS.md) · full tier & layer reference: [packages/AGENTS.md](../../AGENTS.md)

Owner: ticket [53](../../../docs/tickets/53-frontend-architecture-modernization-tanstack-query.md). `client` tier,
layer T5, the app-module layer: it sits on `@vp/api-client` (T4) and below the apps (T6).

## What it holds

- `createQueryClient()`: one per request on the server and one per tab, a `staleTime` above zero so hydration
  never refetches, no retry on the server and none for a 4xx in the browser.
- `createAppRouter({ routeTree, apiBaseUrl, pending, error, notFound }, options)`: the router every client app's
  `getRouter` returns, with the API client (`createAppApiClient(apiBaseUrl)`, the typed client with the viewer's
  stored token: at `apiBaseUrl` on the server, at this origin's `/api` in the browser), the query cache, the session and the toaster built once per router and put in context
  (`AppRouterContext`), the request's CSP nonce on every script, and the SSR query integration. A spec hands it
  `history`, a `queryClient` or a `nonce` through `AppRouterOptions`. `useLayoutMaxWidth()` reads the width a
  route asks of the layout from its `staticData.layoutMaxWidth`.
- `apiProxyMiddleware(apiBaseUrl)`: the request middleware each app's `src/start.ts` mounts, answering the
  browser's `/api/...` from the API with an allowlist of request headers and the browser's address appended to
  `X-Forwarded-For` (SDD §11, Transport).
- `ApiProvider` and `useApi()` hand the client in router context to components. `useApi()` outside the provider
  throws, naming it.
- Today's auth seam: `readAuthToken`, `clearAuthToken` (the dev token in `localStorage`), `Session` /
  `guestSession()` for router context, and `AuthProvider` / `useAuth()`: the signed-in account (`accountQueryOptions`,
  asked for only while a token is stored) and the `PermissionsProvider` its user gets. Both apps mount it under
  `ApiProvider`. 56 replaces the token with a cookie session.
- Loader helpers: `ensureFound` (an API 404 renders the not-found page), `parseParam` (a segment its schema
  refuses renders it too), `keysetPaging` and `KEYSET_PAGE_SIZE`.
- The query factories both apps read, each taking the client: `videoQueryOptions(api, id)`,
  `myVideosQueryOptions(api)`, `accountQueryOptions(api)`, and `videoKeys`.

## Rules

- **A factory takes the client as its first argument**; nothing here reads app config: `createAppRouter` takes
  the API base URL from the app, and builds the client from it once.
- **A factory moves here when a second app reads it**, and not before: a query only web reads (feed, channel,
  reactions, subscriptions, categories) stays in web's `features/`.
- **No React component and no UI.** `ApiProvider` and `AuthProvider` are the two providers, and they hold nothing
  but the client and the account.

## What does not belong here

- An app's mutations and their cache choreography (`useSetReaction`, `useUploadVideo`): they live with the
  app feature that triggers them.
- Anything that reads `import.meta.env` or an app's `src/config`.
- A route, a page or a layout: the route tree and the fallback pages are the app's, handed to `createAppRouter`.

```bash
pnpm --filter @vp/queries typecheck
pnpm --filter @vp/queries test
```
