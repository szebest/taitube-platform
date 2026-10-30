# AGENTS.md — @vp/queries (the data layer and the session both client apps share)

> Tier rules for this directory: [../AGENTS.md](../AGENTS.md) · full tier & layer reference: [packages/AGENTS.md](../../AGENTS.md)

Owner: tickets [53](../../../docs/tickets/53-frontend-architecture-modernization-tanstack-query.md) (the data
layer) and [56](../../../docs/tickets/56-frontend-universal-auth-session-security.md) (the session). `client`
tier, layer T5, the app-module layer: it sits on `@vp/api-client` and `@vp/intl-react` (T4) and below the apps
(T6).

## What it holds

The data layer:

- `createQueryClient()`: one per request on the server and one per tab, a `staleTime` above zero so hydration
  never refetches, no retry on the server and none for a 4xx in the browser.
- `createAppRouter({ routeTree, apiBaseUrl, pending, error, notFound }, options)`: the router every client app's
  `getRouter` returns, with the API client, the query cache and the toaster built once per router and put in
  context (`AppRouterContext`), the request's CSP nonce on every script, and the SSR query integration. It
  dehydrates the instant the server rendered at and its `Wrap`, `AppWords`, measures relative times from it until
  the page hydrates, so "36 seconds ago" never differs between the two renders. Search
  params are the plain text the URL carries both ways, never JSON, so `?q=1.10` reads `'1.10'`. A spec
  hands it `api`, `history`, a `queryClient` or a `nonce` through `AppRouterOptions`. `useLayoutMaxWidth()` reads
  the width a route asks of the layout from its `staticData.layoutMaxWidth`.
- `createAppApiClient({ apiBaseUrl, onUnauthorized })`: on the server the typed client calls the API at
  `apiBaseUrl` with the session cookie's token; in the browser it calls this origin's `/api` and tells
  `onUnauthorized` of every 401. `createAppRouter` builds it, with `endSession` as that callback.
- `ApiProvider` and `useApi()` hand the client in router context to components. `useApi()` outside the provider
  throws, naming it.
- Loader helpers: `ensureFound` (an API 404 renders the not-found page), `parseParam` (a segment its schema
  refuses renders it too), `keysetPaging` and `KEYSET_PAGE_SIZE`.
- The query factories both apps read, each taking the client: `videoQueryOptions(api, id)`,
  `myVideosQueryOptions(api)`, and `videoKeys`; for clips, `clipQueryOptions(api, id)`, `myClipsQueryOptions(api)` and `clipKeys`.

The user event stream (SDD §10.3, ADR-27):

- `<UserEventStream>`, which each app root mounts once around the shell, inside `SessionProvider`: for a
  signed-in viewer it joins `connectUserEvents`, for a guest it opens nothing. One tab per browser holds the Web Lock
  `vp.user-events.<userId>` and opens the platform `EventSource` on this origin's `/api/v1/me/events` (the
  proxy turns the cookie into the bearer); it posts every event to the other tabs over a `BroadcastChannel` of
  the same name. When it closes, the next tab in the lock's queue opens the stream with `?last-event-id=` set to
  the last id any tab saw, and every tab drops an id it already has. A stream the browser gave up on reopens
  with backoff from that id, and none is open while TanStack Query's `onlineManager` says offline.
- `userEventHandlers`: per `type` of the `UserEvent` union, the query-cache work it does (a `video.processing`
  status patches the video and refetches it and the caller's list, a progress tick patches the progress, and
  `preferences.updated` refetches `['preferences']` unless the cached version is already the saved one, and `comment.created` refetches the creator inbox under `['creator', 'comments']`). It is
  typed by the union, so a new member does not compile until it has a handler
  (`src/__tests__/type-fixtures/missing-handler.ts`). A `hello` whose `resume` is `fresh` (every stream opened
  with no id: the first one, or a takeover before any tab saw an id) refetches the active video queries, for
  what changed before the stream opened, and a tab that joins behind a leading one (it gets no `hello`) does the
  same when it joins; `expired` refetches every query. A new event type is its schema in `@vp/api-contracts`,
  its producer, and its row here.
- `useUserEvent(type, handler)` for a component below it that reacts to an event (a toast), called after the
  cache work.

The session (SDD §11, Transport and Origins and cookies):

- `sessionMiddleware({ apiBaseUrl, cookieDomain, refresh? })`: the request middleware each app's `src/start.ts`
  mounts after the CSRF check and the security headers. It answers `/api/...` from the API (`proxyToApi`: an
  allowlist of request headers, the session cookie's token as the bearer, the browser's address appended to
  `X-Forwarded-For`, a refused token refreshed once through `refresh`, single-flight per refused token in this
  process, or the cookie cleared; a write body over 1 MiB answered 413 before it is forwarded), and hands every
  other request the cookie domain.
- The cookie, `SESSION_COOKIE` (`vp.session`): httpOnly, `SameSite=Lax`, `Secure` off localhost, `Domain` the
  app's `COOKIE_DOMAIN`. Only server code writes it: the proxy, `signOut`, and the dev personas' sign-in;
  `hasSession` tells the browser whether one is there.
- `ensureSession(context)`: what the root route's `beforeLoad` returns as `auth`, the `Session` (a guest, or the
  account `GET /v1/me/account` answers for the token), cached in the query client and dehydrated into the page.
  `viewerOf(session)` is who `@vp/permissions` decides for.
- `requireSignedIn` (`_authed`'s `beforeLoad`) and `leaveLoginWhenSignedIn` with `LoginSearchSchema`
  (`/login`'s), which keeps a `redirect` only when it stays on this origin.
- `settleSession(router)` after a sign-in or a sign-out, and `endSession(router)`, which sends a signed-in viewer
  whose token the API refused to `/login?redirect=<where they were>`, with no reload.
- `SessionProvider` (the session from router context, and the `PermissionsProvider` it fills) and `useAccount()`.
- `useSignOut()`, which ends the session on both apps and loads the routes again as a guest; the sign-in card and the account menu it feeds are `@vp/components`' parts, wrapped in each app's `features/auth/components/`. `@vp/queries/dev-personas` is development only: the
  `PersonaSwitcher` and its `signInAsPersona` server function, which signs in with a token `pnpm dev-token serve`
  mints. Each app imports it behind `import.meta.env.DEV` in its `/login` route, and the bundle guard in
  `@vp/vite-preset` fails a build in which anything under `src/dev-only/` reaches a client or a server chunk.

## Rules

- **A factory takes the client as its first argument**; nothing here reads app config: the app hands
  `createAppRouter` its API base URL and `sessionMiddleware` its config.
- **A factory moves here when a second app reads it**, and not before: a query only web reads (feed, channel,
  reactions, subscriptions, categories) stays in web's `features/`.
- **A server function is a thin wrapper.** The cookie and the request are read in plain functions
  (`session-cookie.ts`); a spec runs the wrapper through `@vp/web-testing`'s doubles, since vitest has no Start
  compiler.
- **UI only for the session.** The login page (and the account menu) sit here because they render the session
  both apps share; a page or a layout of one app does not. Plain markup until the shell ticket styles it.

## What does not belong here

- An app's mutations and their cache choreography (`useSetReaction`, `useUploadVideo`): they live with the
  app feature that triggers them.
- Anything that reads `import.meta.env` or an app's `src/config`.
- A route or a layout: the route tree and the fallback pages are the app's, handed to `createAppRouter`; the
  `/login` and `_authed` route files are each app's too, built from the pieces above.

```bash
pnpm --filter @vp/queries typecheck
pnpm --filter @vp/queries test
```
