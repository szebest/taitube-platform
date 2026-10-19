# 56: Frontend universal auth, session security & XSS / token hardening

| Field | Value |
|---|---|
| Phase | 5 — Developer experience & growth |
| Issue | [#56](https://github.com/szebest/taitube-platform/issues/56) |
| Size | M |
| Blocked by | 38 - User identity · 53 - Data layer on TanStack Query · 54 - Frontend testing infrastructure · 89 - TanStack Start foundation · 91 - Web import aliases · 93 - Creator Studio as its own app · 95 - Design system 2 |
| Blocks | 60, 61, 62, 72 |
| Spec | [SDD §11 Security](../SDD.md#11-security) · [SDD §6.1 Endpoints](../SDD.md#61-endpoints) |

**Status:** blocked

> **Two apps, one session (after 93).** [93](93-creator-studio-separate-app.md) splits the creator surface into
> `apps/client/studio` on its own origin (`localhost:5174` next to web's `:5173`, `studio.<domain>` next to
> `<domain>` in cloud). Everything below is written once, in a client-tier package both apps use (the server
> functions, the request middleware that fills `auth`, the 401 handling, the login route component and the account
> menu), and each app mounts it. It is one cookie for both apps: `SameSite=Lax` already treats the two hosts as
> one site, and the cookie's `Domain` comes from `VITE_COOKIE_DOMAIN` (empty locally, where a cookie spans ports
> anyway). Signing out of either app signs out of both.

## What to build

Today the web app reads a bearer JWT (minted with `pnpm dev-token`) from `localStorage` in
`src/auth-token.ts`, there is no sign-in flow, and SSR renders every page as a guest. This ticket moves the
session to a cookie the server can read, puts the user in router context, and replaces the legacy
`AuthorizedContainer` and login component.

### 1. Session

- The token lives in an `httpOnly`, `SameSite=Lax` cookie (`Secure` outside localhost), set and cleared by
  `signIn` / `signOut` server functions (`createServerFn`) in `src/features/auth/`. JavaScript never reads it.
- Request middleware reads the cookie, loads the account from `GET /v1/me/account`, and fills `auth` in the
  router context 89 created, so SSR renders the signed-in page.
- A 401 from the API goes through the `apiClient` seam in `src/integrations/api/`: with a refresh token (an
  OIDC provider), the server refreshes once and the request is retried; without one (dev tokens), the session
  is cleared and the user lands on `/login?redirect=<current>`. No full-page reload.
- `src/auth-token.ts` and every `localStorage` token read are deleted.

### 2. Routes

- `/login`: sign in with the configured OIDC provider (from 38), or, in development only, the persona
  switcher. The page is built from `@vp/ui` primitives ([95](95-design-system-2.md) section 5) on the
  guide's layout ([docs/design/README.md section 7](../design/README.md#7-layout-and-the-shell)); a failed
  sign-in shows its presented message in a `Callout`, and a session that expired lands here with an
  `EmptyState` line saying so above the form.
- A member-only section on a public page (the You hub, the followed channels in the rail) shows a guest 95's
  `EmptyState` (section 6) with one editorial line and one action, Sign in, linking to
  `/login?redirect=<current>`; a whole member-only route redirects through `_authed` instead.
- The `_authed` layout route gets a `beforeLoad` that redirects a guest to `/login?redirect=...`. The legacy
  `AuthorizedContainer` is deleted.
- `_authed` drops the `ssr: false` 53 gave it, so its loaders run on the server with the cookie session.
- The legacy account dropdown in `src/layout/components/login/` becomes an account menu in
  `src/features/auth/components/` on `DropdownMenu` and `Avatar` from `@vp/ui`, mounted in the header slot of
  95's `AppShell` ([58](58-modern-browse-layout-microinteractions-motion.md) mounts the shell), with sign out
  through `signOut`.

### 3. Dev personas

- A dev-only switcher (Guest, User, Creator, Admin) signs in with a locally minted token, so a fresh clone can
  act as any persona after `pnpm dev`. `@vp/dev-token` is a server package the web app cannot import, so the
  switcher calls a mint endpoint added to the local `dev-token serve` process. The switcher and the endpoint
  are absent from production builds.

### 4. Permissions

- `useCan` and `<Can>` already exist (`@vp/permissions-react` after 93). `PermissionsProvider`
  takes its user from router context instead of the legacy `AuthProvider`, which is deleted.
- Edit video, delete video, pin comment and the admin link render through `useCan`; no role comparison in a
  component.
- No `dangerouslySetInnerHTML` anywhere in `src/`; user text renders as React text.

## Acceptance criteria

- [ ] SSR HTML for a signed-in cookie contains the user's channel name; for no cookie it renders the guest
      header.
- [ ] No `localStorage` token read remains; the cookie is `httpOnly` (asserted on the `signIn` response).
- [ ] A guest opening the studio's `/upload` is redirected to the studio's `/login?redirect=/upload`, and
      signing in lands back on `/upload` (route spec through `renderRoute` from 54); the same on web's
      `/subscriptions`.
- [ ] Signed in on one app means signed in on the other, and signing out of one signs out of both (Playwright,
      both origins).
- [ ] 401 handling: with a refresh token the request is retried once; without one the session is cleared and
      the user is redirected (specs with MSW).
- [ ] The persona switcher works in dev and is absent from the production build (asserted on build output).
- [ ] Per persona, the admin link and the edit/delete actions show or hide as `@vp/permissions` decides (one
      `it.each` over personas).
- [ ] Zero-matches rows for `dangerouslySetInnerHTML` and `localStorage` token access in `apps/client/*/src`.
- [ ] `AuthorizedContainer`, `AuthProvider`, `src/auth-token.ts` and `src/layout/components/login/` are gone.
- [ ] Meets the polish bar ([docs/design/README.md section 9](../design/README.md#9-the-polish-bar)) on every
      surface this ticket builds.
- [ ] `/login`, the account menu and the signed-out `EmptyState` are composed from `@vp/ui`,
      `@vp/components` and web's app kit only: `src/features/auth/` holds no stylesheet and no class outside layout utilities.
- [ ] A failed sign-in moves focus to the `Callout` and keeps the form's input; the account menu opens with
      Enter from the header avatar, arrows move through it and Escape returns focus to the avatar (jsdom
      specs).
- [ ] The signed-in header's avatar is in the server render at its final size, so hydration shifts nothing
      (the header contributes 0 to CLS in the Playwright run).
- [ ] `pnpm --filter @vp/web test`, `pnpm --filter @vp/studio test`, `pnpm typecheck`, `pnpm lint` green;
      `make smoke-offline` passes.

## Out of scope

- MFA flows.
- The shell the account menu sits in: [58](58-modern-browse-layout-microinteractions-motion.md) mounts 95's `AppShell`.
- The XSS and privilege-escalation browser suite: [75](75-fullstack-e2e-playwright-security-perf-validation.md).
- Admin route guards: [61](61-admin-control-panel-category-moderation-ui.md).

## Open questions

- The browser still needs the token for API calls. Default: the browser calls the API through a same-origin
  server route that attaches the bearer from the cookie, so the token is never readable. The alternative is
  the API accepting the session cookie directly, which needs credentialed CORS from 49. Decide in the PR and
  record it in SDD §11.

## Definition of Done

- [ ] All acceptance criteria proved with command output in the PR.
- [ ] SDD §11, `apps/client/web/AGENTS.md` and `apps/client/studio/AGENTS.md` describe the session model.
- [ ] Ticket status set to `done` and `python3 docs/tickets/gen-index.py` re-run.
