# AGENTS.md — @vp/queries (the data layer and the session both client apps share)

> Tier rules for this directory: [../AGENTS.md](../AGENTS.md) · full tier & layer reference: [packages/AGENTS.md](../../AGENTS.md)

Owner: tickets [53](../../../docs/tickets/53-frontend-architecture-modernization-tanstack-query.md) (the data
layer) and [56](../../../docs/tickets/56-frontend-universal-auth-session-security.md) (the session). `client`
tier, layer T5, the app-module layer: it sits on `@vp/api-client` and `@kit/intl-react` (T4) and below the apps
(T6).

## What it holds

The data layer:

- `createQueryClient()`: one per request on the server and one per tab, a `staleTime` above zero so hydration
  never refetches, no retry on the server and none for a 4xx in the browser.
- `createAppRouter({ routeTree, apiBaseUrl, pending, error, notFound }, options)`: the router every client app's
  `getRouter` returns, with the API client, the query cache and the toaster built once per router and put in
  context (`AppRouterContext`), the request's CSP nonce on every script, and the SSR query integration. It
  dehydrates the instant the server rendered at and the negotiated locale; its `Wrap`, `AppWords`, measures
  relative times from that instant until the page hydrates and renders the locale store's snapshot, whose
  catalogue the browser loads before it hydrates, so neither "36 seconds ago" nor a word differs between the
  two renders. Search
  params are the plain text the URL carries both ways, never JSON, so `?q=1.10` reads `'1.10'`. A spec
  hands it `api`, `history`, a `queryClient` or a `nonce` through `AppRouterOptions`. `useLayoutMaxWidth()` reads
  the width a route asks of the layout from its `staticData.layoutMaxWidth`.
- `requestLocale(locales, { searchStr, persisted })`: the negotiation chain (`lang` param, saved preference,
  `Accept-Language` on the server or `navigator.languages` in the browser, `en`), called from each app's root
  `beforeLoad`; the only module that reads the browser's languages (`single-locale-source.test.ts`).
- `createAppApiClient({ apiBaseUrl, onUnauthorized, getViewerSession? })`: on the server the typed client calls the
  API at `apiBaseUrl` with the session cookie's token and the request's `vp.video-access.*` unlock cookies, so a page
  reloaded after an unlock renders unlocked; in the browser it calls this origin's `/api`, tells `onUnauthorized` of
  every 401 and sends `getViewerSession()` as `x-viewer-session`, the tab's key the API picks test variants by. The
  server never sends one, so a server render carries the control. `createAppRouter` builds it, with `endSession` as
  that callback and the app's `getViewerSession` (web's; the studio passes none, so its edit form reads the stored
  title).
- `ApiProvider` and `useApi()` hand the client in router context to components. `useApi()` outside the provider
  throws, naming it.
- Loader helpers: `ensureFound` (an API 404 renders the not-found page), `parseParam` (a segment its schema
  refuses renders it too), `keysetPaging` and `KEYSET_PAGE_SIZE`.
- The query factories both apps read, each taking the client: `videoQueryOptions(api, id, shareToken?)` (the token
  goes with the read and stays out of the key, so every part of the page reads the entry the token's read filled;
  `correctionsQueryOptions(api, id, shareToken?)` does the same),
  `myVideosQueryOptions(api)`, and `videoKeys`; for clips, `clipQueryOptions(api, id)`, `myClipsQueryOptions(api)` and `clipKeys`.
- `notificationKeys`, `unreadNotificationCountQueryOptions(api)` and `setUnreadCount`: the bell's cache, which the
  user event handlers below write, so the keys have one owner here; web's notification list files under
  `notificationKeys.lists()`.

The user event stream (SDD §10.3, ADR-27):

- `<UserEventStream>`, which each app root mounts once around the shell, inside `SessionProvider`: for a
  signed-in viewer it joins `connectUserEvents`, for a guest it opens nothing. One tab per browser and identity
  holds the Web Lock `vp.user-events.<slot>.<channel>.<userId>` and opens the platform `EventSource` on this
  origin's `/u/<slot>/api/v1/me/events` (the proxy turns the slot's cookie into the bearer); it posts every event to the other tabs over a `BroadcastChannel` of
  the same name. When it closes, the next tab in the lock's queue opens the stream with `?last-event-id=` set to
  the last id any tab saw, and every tab drops an id it already has. A stream the browser gave up on reopens
  with backoff from that id, and none is open while TanStack Query's `onlineManager` says offline.
- `userEventHandlers`: per `type` of the `UserEvent` union, the query-cache work it does (a `video.processing`
  status patches the video and refetches it and the caller's list, a progress tick patches the progress, and
  `preferences.updated` refetches `['preferences']` unless the cached version is already the saved one, `notification.created` and `notification.read` set the unread count and refetch every notification list, and `comment.created` refetches the creator inbox under `['creator', 'comments']`). It is
  typed by the union, so a new member does not compile until it has a handler.
  A `hello` whose `resume` is `fresh` (every stream opened
  with no id: the first one, or a takeover before any tab saw an id) refetches the active video queries, for
  what changed before the stream opened, and a tab that joins behind a leading one (it gets no `hello`) does the
  same when it joins; `expired` refetches every query. A new event type is its schema in `@vp/api-contracts`,
  its producer, and its row here.
- `useUserEvent(type, handler)` for a component below it that reacts to an event (a toast), called after the
  cache work.

The session (SDD §11, Transport and Origins and cookies; slots and identities from ticket 129):

- A browser holds up to `ACCOUNTS_MAX` accounts (`accountsMax`, default 10), each in its **slot** (0 to 9), and a
  tab acts as one **identity**, `{ slot, channel? }`, named in its URL as `/u/<slot>[/c/<handle>]`
  (`account-slots.ts`: `parseIdentityPath`, `identityPath`, `identityKey`). With one account on its primary
  channel no prefix appears; the router's `rewrite` strips it on the way in and adds it on the way out, so routes
  never see it. `appLink(origin, path, tab)` (and `useAppLink()`) keeps the identity on a link into the other app.
- `sessionMiddleware({ apiBaseUrl, cookieDomain, devTokenUrl, accountsMax, refresh? })`: the request middleware
  each app's `src/start.ts` mounts after the CSRF check and the security headers. It moves a pre-slot
  `vp.session` cookie into slot 0 once, resolves the request's identity (`resolveRequestIdentity`: the prefix,
  else `X-Account-Slot`, else the default slot `vp.accounts` remembers), and answers `/api/...` from the API
  (`proxyToApi`: an allowlist of request headers with `x-viewer-session` among them, the slot's token as the bearer,
  the browser's `vp.video-access.*` cookies and none of its others, the browser's address appended to
  `X-Forwarded-For`, a write that names no slot refused 403, a refused token refreshed once through
  `refresh`, single-flight per refused token in this process, or that slot alone cleared and marked expired; a
  write body over 1 MiB answered 413 before it is forwarded; every `Set-Cookie` of the API dropped but a video
  unlock, which `reissueVideoAccessCookies` sets again on this origin, `HttpOnly`, `SameSite=Lax`, for the
  `Max-Age` the API gave). A page with no prefix in a browser of two or more
  accounts is a 302 to the default identity's prefix, a prefix for a slot with no session a 302 to
  `/login?slot=<n>&reason=expired`, and a signed-in page is `Cache-Control: private, no-store`. Every other
  request gets the settings in its context (`requestSession()`).
- The cookies: `vp.session.<slot>` holds that slot's bearer token, httpOnly, `SameSite=Lax`, `Secure` off
  localhost, `Domain` the app's `COOKIE_DOMAIN`, eight hours; `vp.accounts` (`accounts.ts`, `accounts-cookie.ts`)
  is the non-secret slot list (user id, label, avatar, acting channel, expired) with the default slot, cut so
  ten rows always fit one cookie (`serializeAccounts` drops the avatar hints that would not);
  `vp.add-nonce` binds an add to the browser that started it, httpOnly, ten minutes, one use. Only server code
  writes them.
- The browser's API client names its slot on every call (`X-Account-Slot`, a custom header no cross-site form
  sends); the stream, which an `EventSource` cannot give a header, names it in its path (`/u/<slot>/api/...`).
- `completeSignIn(issue, grant, target)` (`sign-in.ts`) is every sign-in's callback: an add (`{ mode: 'add',
  state }`) spends its nonce first, as does a new user into one slot beside another (`{ mode: 'slot', slot, state }`,
  recorded as an add), the token is always the new one `issue` returns, a user already in a slot
  (signed in or expired) ends on it, an add takes the lowest slot with neither a session nor a row (else the
  lowest expired row), a session past `ACCOUNTS_MAX` is refused, and `POST /v1/me/security/sign-ins` records it (the API
  rate-limits adds) before the cookie is written. Server functions: `hasSession`, `signOut`, `signOutAll`,
  `expireSession`, `rememberIdentity`, `startAddAccount`, `listAccounts` (the rows, one whose cookie is gone read as
  expired), `setIdentityAccent` and `setPinnedIdentities` (`vp.accounts` keeps up to 10 picked ring colours and 8
  pins inside its 4 KB budget; `accounts.test.ts` proves the worst case).
- `createAppRouter` keeps one `IdentityStore` per router (`identity` in context): the identity and the one
  `QueryClient` that is its own. `switchIdentity(router, next)` builds the next identity's client and drops the
  last one, cancelling its loads, then replaces the URL under the new prefix; `settleSession` (after a sign-in or a
  sign-out) and `endSession(router, slot)` (a 401 on this tab's slot, which goes to `/login?slot=<n>`) renew the
  client the same way. No client is ever `clear()`ed under its readers (a zero-matches row).
- `ensureSession(context)`: what the root route's `beforeLoad` returns as `auth`, the `Session` of the router's
  identity (a guest, or the account `GET /v1/me/account` answers for the slot's token, with `actingChannelId` for a
  `/c/<handle>`), cached in that identity's client and dehydrated with the identity into the page.
  `viewerOf(session)` is who `@vp/permissions` decides for.
- `requireSignedIn` (`_authed`'s `beforeLoad`) and `leaveLoginWhenSignedIn` with `LoginSearchSchema`
  (`/login`'s), which keeps a `redirect` only when it stays on this origin, and stays on `/login` for `add=1` or
  another `slot`.
- `SessionProvider` (the session and the `identity` from the root, and the `PermissionsProvider` it fills, keyed by
  the identity and its viewer so a switch mounts everything below afresh: no ability, stream, query observer or
  state outlives its identity), `useAccount()`, `useIdentity()`, `useActingChannelId()` (the channel the identity
  names, which the studio acts on over the one last chosen), `useTabIdentity()` (the router's, for the root).
- `useSessionSync()`, mounted by each app root: a `BroadcastChannel` tells this origin's tabs of an add or a
  sign-out (a tab on a removed slot goes to `/login`, the rest stay), and a tab coming back into focus asks
  `hasSession` for its slot, which is how a sign-out on the other app reaches it. Back or forward onto an entry
  made under another identity acts as that one again (`followIdentity`, its own cache).
- `useSignOut()` signs this tab's slot out of both apps and moves it to the default of the slots left, or loads the
  routes again as a guest; `useSignOutAll()` clears every slot. The sign-in card and the account menu it feeds
  are `@kit/components`' parts, wrapped in each app's `features/auth/components/`. `@vp/queries/demo-personas` is
  for local demos: the `PersonaSwitcher` (into this tab's slot, `slot`, or `adding` one) and its
  `signInAsPersona` server function, a `completeSignIn` whose provider is `pnpm dev-token serve`, at the address
  `sessionMiddleware` was given as `devTokenUrl`. Each app imports it behind `VITE_DEMO_PERSONAS` in its `/login`
  route, and the bundle guard in `@kit/vite-preset` fails a build with the flag off in which anything under
  `src/demo-personas/` reaches a client or a server chunk.

The switcher (`identities/`, SDD §11; ticket 129's section 5):

- `IdentitySwitcherProvider({ fallback })`, mounted by each app root above `SessionProvider`, so its state survives
  the remount a switch causes: which surface is open (`show('switcher' | 'create-channel')`), the identity on its way
  (the header draws it on the click), `Alt+Shift+A` on `event.code`, and after a switch the toast with Undo, a polite
  announcement and focus on the page's `h1`. `switchTo` loads `switch-flow.ts` on first use: `switchInPlace` keeps
  the page or lands on `fallback` when the new identity cannot see it, and rolls a failed switch back. A part drawn
  outside a provider (a page in a spec) gets one that stays closed.
- `useIdentityChoices(open)` is the one list: `identityEntries` (pinned first, then each slot, the tab's account
  with its other channels and teams from `GET /v1/me/identities`, asked once the list is open, another account is
  signed in or the URL names a channel) and what choosing a row does (an expired one goes to
  `/login?slot=<n>&reason=expired`, any other switches in place). `prefetch(entry)` fills the cache the switch will
  land on (`IdentityStore.prepare`, once per 5 s per identity). The other accounts' counts come from
  `glanceAccounts` (`account-glance.ts`), one server call for every other slot, only while open.
- `AccountSwitcher({ links, manage, children, onSignOut })` is the header's account button: the ring when the browser
  holds more than one identity, the menu's rows (`account-switcher-items.tsx`) loaded as the pointer or focus reaches
  it, the bottom sheet on a narrow screen. `IdentitySwitcherDialog` is the searchable dialog and sheet each app loads
  lazily behind `WhenSwitcherOpened`, with `CreateChannelDialog`. `OpenAsLinks` gives a link of this app an "Open
  as..." menu. `ActingAsLine` and `useIdentityGuard` are a composer's: the identity a write goes out as, and a write
  fired after the identity changed held and asked again. `studioPathForChannel` is the studio's `/for/<handle>`.

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
