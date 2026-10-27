# 129: Multiple accounts and channels - signed in at once, one switcher, per-tab identity

| Field | Value |
|---|---|
| Phase | 5 - Developer experience & growth |
| Size | XL |
| Blocked by | 38 - User identity · 56 - Frontend universal auth, session security · 72 - Settings and customization · 95 - Design system 2 · 98 - Realtime user event stream · 99 - Notifications · 117 - Channel team roles |
| Blocks | — |
| Spec | [SDD §11 Security](../SDD.md#11-security) · [SDD §6.1 Endpoints](../SDD.md#61-endpoints) · [SDD §5 Domain model & DDL](../SDD.md#5-domain-model--database-schema) · [SDD ADR-24 Result-typed errors](../SDD.md#adr-24--result-typed-error-handling-domain-returns-the-edge-decides) |

**Status:** blocked

> **Why.** One browser holds one session and one user holds one channel. Anyone with a personal account and a creator
> account signs out and in again to change hats, loses the page they were on, and cannot tell which hat they are
> wearing when they comment. [38](38-user-channel-identity-universal-auth.md) made `channels.user_id` unique;
> [56](56-frontend-universal-auth-session-security.md) made the session one `vp.session` cookie for web and studio;
> [117](117-channel-team-roles.md) added a studio switcher for channels you are a member of and left brand
> accounts and ownership transfer out. This ticket makes several accounts live side by side in one browser, lets one
> account own several channels, and puts all of it behind one switcher that is instant, always says who you are, and
> never lets data or a write cross from one identity to another.

> **Builds on, does not redo.** Sign-in, the OIDC flow, dev personas, single-flight refresh, the same-origin API proxy
> and the CSRF check are 56's and keep working; this ticket makes the session a set of slots and teaches each piece
> which slot it is acting for. Membership, roles and the audit log are 117's; the switcher 117 ships in the studio is
> replaced by the one below, and 117's `GET /v1/me/memberships` stays as the member half of it. The bell and
> `unread-count` are [99](99-notifications.md)'s, the stream is [98](98-realtime-user-event-stream.md)'s, the settings
> shell this ticket adds one section to is [72](72-frontend-settings-customization-system.md)'s, and the menu,
> sheet and command components are [95](95-design-system-2.md)'s (the shell and account menu from #223).

### Vocabulary

- **Account**: a user, one sign-in. **Slot**: the number (0 to 9) a signed-in account holds in this browser.
- **Channel**: owned by one user (`channels.user_id`), or worked on as a member (117).
- **Identity**: `{ slot, channelId }`. A tab is exactly one identity at any moment; every request, cache, stream and
  permission check belongs to it.

## Product decisions

| Question | Decision |
|---|---|
| Where is the identity chosen? | Per tab, in the URL: `/u/<slot>` and, when the acting channel is not the account's primary one, `/u/<slot>/c/<handle>`. Two tabs are two identities; a reload, a back button and a copied tab keep theirs; SSR can read it before anything runs. Not a header or sessionStorage alone, because SSR has neither. |
| Does a one-account browser change? | No. With a single account and its primary channel no prefix appears and every URL is as today. The prefix starts when a second account signs in, so shared and canonical links stay clean ("Copy link" always drops it). |
| What is the per-browser part? | The default for a new tab with no prefix: the last identity switched to. It is kept in a non-secret cookie; a tab never follows it after load. |
| Cap | 10 accounts per browser (`ACCOUNTS_MAX`, `env-schema`), 5 owned channels per user (`CHANNELS_MAX_OWNED`). Both are config, not constants. |
| Cross-account "post as" from inside a tab | No. A tab is one identity, and a write from a tab never borrows another slot's session; switching is one click and the composer says who you are. Revisit if switching proves too slow. |
| Cross-account unread | Counts for the other accounts, fetched when the switcher opens (and while it is open), never a stream per account: one `EventSource` per tab. |
| Ownership transfer | Out. It needs a consent handshake, a handle and subscriber-count policy and an audit story that deserve their own ticket; this one only guarantees the schema does not forbid it (`channels.user_id` is a plain owner column). |
| Playlists, library, history, preferences, notifications | Stay per account, not per channel. Subscribing, commenting and uploading are per channel. |
| Identity broker | None beyond 56's OIDC provider and the local dev tokens. Adding an account runs the same provider flow again. |

## What to build

### 1. Several channels per user

- Migration: drop the unique constraint on `channels.user_id`, keep `channels_user_id_idx`; add `channels.is_primary
  boolean not null default false` with a partial unique index on `(user_id) where is_primary`; backfill every existing
  channel to `true`. The primary channel is the one `GET /v1/me/account` returns and the default identity of an
  account; it cannot be deleted while it is the only one, and promoting another is `PATCH /v1/me/channels/:id`.
- `channel_id` becomes the actor and owner column where today a user id stands in for a channel (every row below
  backfilled from the owner's single channel, so existing data is untouched):

  | Today | Becomes |
  |---|---|
  | `videos.owner_id` (user) | keeps `owner_id` as the uploader, adds `channel_id` for the channel it belongs to |
  | `video_comments.author_id` | keeps `author_id`, adds `author_channel_id`, so a comment shows the channel that wrote it |
  | `channel_subscriptions.subscriber_id` (user) | `subscriber_channel_id`; unique `(subscriber_channel_id, channel_id)`; a channel cannot subscribe to itself |
  | `videoViews.channelTimeline/Totals/topVideos(ownerId)`, `AnalyticsService` | keyed by channel id |
  | `playlists.owner_id`, `watch_history`, `video_reactions`, preferences, notifications | unchanged: per account |

- Places that assume one channel per user, each changed here (grep `findByUserId`, `findByUserIds`, `loadChannelsOf`,
  `ownerId`): `ChannelRepositoryPort` and its postgres and in-memory adapters (`findByUserId` becomes `listByUserId` and
  `findPrimaryByUserId`; the contract suite follows), `channel-service.ts` (`getAccount`, `updateChannel`, provisioning on
  first sign-in creates the primary channel only), `video-views.ts` `loadChannelsOf` and its `ChannelOf` map (keyed by
  channel id, not owner id), `video-service.ts`, `search-service.ts`, `related-service.ts`, `creator-studio-service.ts`,
  `upload-initiate.ts`, `analytics-service.ts`, `in-memory-comment-repository.ts` and `watchable-video.ts`.
- [38](38-user-channel-identity-universal-auth.md)'s channel resource keeps its shape; `GET /v1/me/account` still
  returns `channel` (the primary), and gains `channels: ChannelCard[]` (owned). `PATCH /v1/me/channel` edits the acting
  channel (the `X-Channel-Id` below), so existing callers keep working.

### 2. API

| Endpoint | What |
|---|---|
| `POST /v1/me/channels` | create an owned channel `{ handle, displayName }`; 409 over `CHANNELS_MAX_OWNED`; handle rules are 38's |
| `PATCH /v1/me/channels/:id` | make it primary (owner only) |
| `GET /v1/me/identities` | one list: the account, its owned channels, and the member channels from 117 with their role; the one source the switcher renders |

- `X-Channel-Id` (117) generalises: every `/v1/me/...`, `/v1/creator/...` and every write that acts as a channel (comment,
  subscribe, upload) reads it, validated against the caller's owned channels and memberships; absent means the primary.
  One resolver in the auth plugin puts `actingChannel` on `UserContext`; no service reads the header.
- `UserContext` carries `actingChannelId` and the role map from 117, so a rule never queries (Rule 8).
- Rules in `@vp/domain-rules` return `Result` (Rule 14): the channel cap, handle taken, not the owner, header names a
  channel the caller has no relation to. New codes land in `@vp/errors` and SDD §6.2.
- Creating a channel, promoting one and every acting-channel write append to 117's `channel_audit_log`; each sign-in
  into a slot appends `account.signed_in` to a small per-user `account_audit_log` (the user's own, readable at
  `GET /v1/me/security/sign-ins`), since 117's log is per channel.
- Contracts in `@vp/api-contracts`, the committed OpenAPI document and SDD §6.1.

### 3. Sessions: slots

- One httpOnly, `SameSite=Lax` cookie per slot, `vp.session.<slot>`, holding that account's bearer token exactly as
  `vp.session` does today (same `Domain`, `Secure`, lifetime); JavaScript reads none. `vp.session` is read once as slot 0
  for a browser that signed in before this ships, then rewritten. One more non-secret cookie, `vp.accounts`, holds the
  slot list with a display label and avatar hint per slot, the default slot and the acting channel per slot, so a
  signed-out or expired row can still be drawn. 10 tokens must fit the header budget: `ACCOUNTS_MAX` is proved against
  the largest real token, and the Node servers and the ingress get a header limit that holds it.
- `readSessionToken()`, `writeSessionCookie()` and `clearSessionCookie()` in `@vp/queries` take a slot; the request
  middleware strips `/u/<slot>[/c/<handle>]` with a router `rewrite` (input and output), puts `slot` and the channel in
  the request context, and the proxy sends the slot's token as the bearer and the channel as `X-Channel-Id`. The slot
  and channel come from the URL on a document request and from an `X-Account-Slot` header the client adds to every
  proxied call (a custom header, so no cross-site form can send it; the CSRF check from 56 still runs first).
- With two or more accounts, an unprefixed document request for a signed-in page 302s to the default slot's prefix
  (`replace`, never a new history entry); a prefix for a slot with no cookie goes to `/login?slot=<n>&reason=expired`.
- **Add account**: `/login?add=1` opens the provider flow in a popup window (a sheet on mobile, a same-tab redirect with
  `redirect` where popups are blocked) with `prompt=select_account` so the provider cannot silently reuse the last
  login; the state is bound to a one-time nonce in a short-lived httpOnly cookie; the callback issues a **new** token into
  the **first free slot** and never accepts a token from the request. If the user is already in a slot the flow ends on
  that slot ("already signed in"), so one user never holds two slots. The opener switches to the new slot in place and
  returns to the page it was on. Dev personas add slots the same way.
- **Refresh and expiry per slot**: 56's single-flight refresh is keyed by the refused token, so it is per slot already;
  a refresh that fails clears that slot only and marks it `expired` in `vp.accounts`. A tab on an expired slot shows
  56's re-auth prompt for that slot; other tabs and slots are untouched.
- **Sign out of this account** clears one slot cookie, revokes that token at the provider where it supports it, and
  moves the tab to the default slot (or `/login` with none left). **Sign out of all** clears every slot and
  `vp.accounts`. Neither touches another slot's cookie or token.
- **Web and studio in sync**: both read the same cookies and the same prefix scheme; the studio link from web and the
  web link from studio carry the slot and channel through one `appLink()` helper. A `BroadcastChannel` message on add,
  sign-out and slot removal lets open tabs react (a tab on a removed slot goes to `/login`, the rest stay put).
- **Security**: adding an account is rate-limited per IP and per browser (`@fastify/rate-limit`, 5 per 10 minutes,
  `rateLimitProblem`); every add and sign-in is audited (above); session fixation is closed by the new-token rule and
  the nonce; SDD §11 documents slots, the header, the prefix and the budget.

### 4. Isolation (the four rules)

- **Cache**: the router context holds one `QueryClient` per identity. A switch builds the next identity's client,
  cancels the old one's queries and drops it, so a response in flight for A resolves into a client nobody reads. No
  `clear()` on a shared client, which races with in-flight requests. Any persisted cache or `sessionStorage`/`localStorage`
  key is namespaced by identity; there is none today and a zero-matches row keeps it that way.
- **Stream**: `UserEventStream` connects with a name and a request keyed by identity (`vp.user-events.<slot>.<channelId>`,
  through the proxy with the slot header), closes the old `EventSource` before opening the new one, and keeps
  `Last-Event-ID` per identity; two tabs on two accounts never share a connection.
- **SSR**: the request middleware resolves the identity from the URL before any loader runs, so the HTML for
  `/u/2/...` holds slot 2's name and data and nothing of slot 0's; responses for a signed-in identity are
  `Cache-Control: private, no-store`.
- **Permissions**: `PermissionsProvider` takes the ability from the identity (account role plus acting channel and its
  117 role) and is keyed by it, so `useCan` re-evaluates on a switch and no ability instance outlives its identity.

### 5. The switcher

One `IdentitySwitcher` part in the shared client kit (95), mounted by the web shell's account menu and by
`StudioWorkspace`, replacing 117's studio switcher. It reads `GET /v1/me/identities` for the active account and the cheap
overview below for the rest.

- **List**: accounts, each with its owned channels nested under it and member channels (with their `RoleBadge`) after
  them. Each row: `Avatar`, name, handle, unread `Badge`, a check on the current one. A search field once the list has
  more than 5 entries. Favourites can be pinned and reordered (kept per browser in `vp.accounts`); pinned rows come first.
- **Other accounts' glance**: opening the switcher (and every 60 seconds while open) calls one server function that
  fans out to each other slot's `GET /v1/me/notifications/unread-count` in parallel, 1.5 s timeout each, and returns
  `[{ slot, unread, newComments? }]`; a hover card or expanded row shows unread notifications and new comments on that
  account's channels without switching. A 401 on a slot turns its row into "Session expired, sign in" with a one-click
  re-auth that opens the add flow for that slot.
- **Speed**: a switch is a client-side navigation in place, with no document reload, no white flash and no sign-in bounce.
  The route is kept when the new identity can see it and falls back to the nearest page it can (for example a studio
  channel page of a channel the new account does not own goes to its studio home, or to web home outside the studio).
  Target: from activation to the new identity's first content painted, 300 ms p95 on a warm cache, 1 s on a cold one,
  measured in Playwright with a throttled API. Hovering or focusing a row prefetches that identity's shell data
  (`/v1/me/account`, `/v1/me/identities`, notification count) and, once per 5 s per row at most.
- **Optimistic**: the avatar, name and accent update on the click, before the network; the page content shows
  skeletons from 95 until its queries land. A failed switch rolls back and toasts the reason.
- **Clarity**: the header avatar carries a ring in the identity's accent (a colour the user picks per identity from the
  token palette, a default derived from the slot; kept in `vp.accounts`). A toast "Now browsing as X" with Undo follows
  every switch. A tab not on the default identity gets `document.title` prefixed with the handle and a favicon dot. Every
  composer that writes as a channel (comment, reply, post, subscribe confirmation) shows the acting avatar and name with an
  inline "Switch" that opens the switcher; a write never fires while the identity differs from what the composer
  rendered.
- **Keyboard**: a global shortcut (`Alt+Shift+A`, matched on `event.code`) opens it; arrows move, Enter switches, `1` to
  `9` jump to the nth row, Escape closes and returns focus to the trigger; the same entries are in the command palette
  (95's `Command`). A switch moves focus to the page's main heading and announces "Now browsing as X" in a polite live
  region. The switcher is a `DropdownMenu` (a `Dialog` plus listbox when searchable) with correct roles and names.
- **Mobile**: a bottom sheet from the account button; a long press on the avatar in the tab bar opens it.
- **Other entries**: "Add account" and "Create channel" (a `Dialog` with handle and name), "Sign out of this account",
  "Sign out of all", a "Manage" link to the new section of 72's settings (`/settings/accounts`: reorder, accent, channels,
  sign-in history).
- **Links**: a link's context menu has "Open as..." with the same list; it opens the link in a new tab on that identity.
- **Context**: opening the studio for channel X acts as the identity that owns or manages X (the slot recorded for X the
  last time it was used in this browser, else the first slot whose account owns or is a member of X).
- New kit parts: `IdentitySwitcher`, `IdentityRow`, `ActingAs` (the composer line), `AccentRing`. Everything else is
  `DropdownMenu`, `Dialog`, `Command`, `Avatar`, `Badge`, `HoverCard`, `Sheet`, `Toast`, `Callout`, `Skeleton` from 95.

## Delivery

One stack of three slices:

1. Data and API: the channels migration and the `channel_id` columns, repositories (postgres, in-memory, contract
   suite), `UserContext.actingChannelId`, `X-Channel-Id` resolver, create and promote endpoints, `GET /v1/me/identities`,
   the audit rows, contracts and SDD.
2. Sessions and isolation: slot cookies, the `/u/<slot>` rewrite and middleware, add, expire, sign out, rate limit,
   per-identity `QueryClient`, stream and permissions keyed by identity, SSR identity, and the browser-side sync.
3. The switcher: `IdentitySwitcher` and its parts in web and studio (replacing 117's), unread overview, accent, toast,
   title and favicon, `ActingAs`, shortcut and palette, mobile sheet, "Open as", the settings section and the e2e suite.

## Acceptance criteria

- [ ] **Add**: a signed-in user adds a second account without signing out; both are listed; adding the same user again
      lands on the existing slot; the 11th (`ACCOUNTS_MAX`) is refused with a message.
- [ ] **Per-tab**: two tabs on two accounts show two names, call the API as two users and survive reload; a tab with
      no prefix opens as the last-switched identity and a one-account browser never shows a prefix.
- [ ] **Isolation, cache**: after a switch no query for the previous identity renders; an in-flight response for A
      that lands after the switch to B never appears (fake API, delayed response).
- [ ] **Isolation, stream**: after a switch the old `EventSource` is closed before the new opens; an event published for
      A afterwards does not reach the tab on B.
- [ ] **Isolation, SSR**: the HTML for `/u/1/...` contains slot 1's name and none of slot 0's; signed-in responses are
      `private, no-store`.
- [ ] **Isolation, permissions**: `useCan` flips on a switch between a creator and a plain viewer, and between an owned
      and a member channel; no stale ability (one `it.each` over identities).
- [ ] **Expiry**: one slot's refresh failing marks only that row expired with a one-click re-auth; other slots and tabs keep
      working.
- [ ] **Sign out**: "this account" clears one cookie and leaves the others valid at the API; "all" clears every cookie;
      open tabs on a removed slot go to `/login`.
- [ ] **Security**: no slot token is readable by JavaScript (asserted on every `Set-Cookie`); a new token is issued on
      add and a request-supplied token is rejected; add is rate-limited (429 with `rateLimitProblem`); a cross-site
      request without the custom header and a valid Origin is refused; sign-ins appear in the user's sign-in history and
      acting-channel writes in 117's audit log.
- [ ] **Web and studio sync**: a switch on web carries into a studio link, and a sign-out on one is seen by the other.
- [ ] **Channels**: a user creates a second channel, up to `CHANNELS_MAX_OWNED`; the backfill leaves every existing video,
      comment and subscription on its channel; comments and subscriptions made "as" the second channel show it and the
      owner's other channels are unaffected; `GET /v1/me/account` still returns the primary.
- [ ] **One switcher**: accounts, owned channels and 117 member channels in one list; a member sees only the channels they
      work on, and a removed membership drops out on the next request.
- [ ] **Speed and feel**: no document reload and no layout flash on a switch (Playwright asserts one navigation entry and
      no `load` event); the target above holds; avatar and name change on the click; hover or focus prefetches.
- [ ] **Route fallback**: switching on a studio page of a channel the new account cannot see lands on a page it can.
- [ ] **Clarity**: ring, toast with working Undo, tab title prefix and favicon dot, and the `ActingAs` line in every
      composer; a write whose identity changed after render is blocked and re-asks.
- [ ] **Switcher UX**: search above 5 entries, pin and reorder, the shortcut, arrows, Enter, `1` to `9`, the command
      palette entry, the mobile sheet and long press, "Open as...", and the studio-for-channel-X context rule.
- [ ] **Cross-account glance**: unread and new comments for the other accounts show without switching, in one fan-out
      call; a slow or failing slot shows no badge and never blocks the list.
- [ ] **Accessibility**: menu or listbox roles, names and focus order, the live-region announcement, focus on the main
      heading after a switch, reduced motion honoured; the polish bar
      ([docs/design/README.md section 9](../design/README.md#9-the-polish-bar)).
- [ ] 99, 72, 73, 113 and 120 each hold a criterion that a switch shows only the new identity's data (added with this
      ticket).
- [ ] `make smoke-offline` passes; no new external host or key. `pnpm typecheck`, `pnpm lint`, `pnpm test`,
      `pnpm test:bun`, `pnpm test:architecture`, `pnpm gen:contracts` (no diff) green, with output in the PR.

## Out of scope

- Ownership transfer between users and brand accounts that outlive their creator (own ticket, see the table).
- Posting as another signed-in account from inside a tab.
- A stream or push for the other accounts' notifications.
- Per-channel library, history or preferences.
- Deleting a channel (117's row) and paid or enterprise multi-user features.
- MFA flows and any external identity broker.

## Testing plan

- Domain rules: an `it.each` over the channel cap, handle, ownership and header failures.
- Repositories: the shared contract suite over postgres and in-memory for `listByUserId`, the primary index and the
  backfill, one file per source file (Rule 12).
- Routes: contract tests for the three endpoints and the `X-Channel-Id` resolver, including the 403s; a
  `privilege-escalation.test.ts` row per endpoint.
- Session: unit specs for slot cookies (`Set-Cookie` flags), the rewrite, redirect rules, per-slot refresh with MSW,
  add (nonce, new token, duplicate user), rate limit and the CSRF header.
- Client: `renderRoute` specs for the switcher (every key, search, pin, announcement, focus), `ActingAs`, the title and
  favicon, and the per-identity `QueryClient`, stream and permissions provider through the suite's one render helper.
- Zero-matches: `localStorage`/`sessionStorage` token access, a shared-client `queryClient.clear()` on a switch.
- E2E (Playwright, both origins): add a second account, switch mid-page with a slow API and assert no stale data and no
  reload; two tabs on two accounts side by side; expire one slot; sign out of one then all; a studio link carrying the
  slot; mobile viewport sheet and long press; the speed target.
- k6 or a unit budget: the unread fan-out stays one call for 10 slots.

## Open questions

- Decided: the identity lives in the URL per tab; the browser keeps only the default for new tabs.
- Decided: one cookie per slot holding the bearer, as 56 does today; a server-side session store is not worth its Redis
  dependency in the client apps. Revisit only if the header budget fails for 10 tokens (then lower `ACCOUNTS_MAX`).
- Decided: ownership transfer and cross-account posting are out.
- To settle in slice 2: whether the global shortcut collides with a screen reader or browser shortcut on macOS and
  Windows; the key moves, nothing else does.

## Definition of Done

- [ ] All acceptance criteria proved with command output in the PR.
- [ ] SDD §5, §6.1, §6.2 and §11, `apps/client/web/AGENTS.md` and `apps/client/studio/AGENTS.md` describe slots and
      identities; the OpenAPI document regenerated; `.env.example` and `env-schema` carry the two caps.
- [ ] Ticket status set to `done` and `python3 docs/tickets/gen-index.py` re-run.
