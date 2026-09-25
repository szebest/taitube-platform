# 56: Frontend universal auth, session security & XSS / token hardening

| Field | Value |
|---|---|
| Phase | 5 — Developer experience & growth |
| Issue | [#56](https://github.com/szebest/taitube-platform/issues/56) |
| Size | M |
| Blocked by | 38 - User identity · 53 - Data layer on TanStack Query · 54 - Frontend testing infrastructure · 89 - TanStack Start foundation |
| Blocks | 60, 61, 72 |
| Spec | [SDD §11 Security](../SDD.md#11-security) · [SDD §6.1 Endpoints](../SDD.md#61-endpoints) |

**Status:** blocked

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
  switcher.
- The `_authed` layout route gets a `beforeLoad` that redirects a guest to `/login?redirect=...`. The legacy
  `AuthorizedContainer` is deleted.
- The legacy account dropdown in `src/layout/components/login/` becomes an account menu in
  `src/features/auth/components/` (plain markup; [58](58-modern-browse-layout-microinteractions-motion.md) styles it in the new shell) with sign out through `signOut`.

### 3. Dev personas

- A dev-only switcher (Guest, User, Creator, Admin) signs in with a locally minted token, so a fresh clone can
  act as any persona after `pnpm dev`. `@vp/dev-token` is a server package the web app cannot import, so the
  switcher calls a mint endpoint added to the local `dev-token serve` process. The switcher and the endpoint
  are absent from production builds.

### 4. Permissions

- `useCan` and `<Can>` already exist (`src/hooks/use-can.ts`, `src/components/can.tsx`). `PermissionsProvider`
  takes its user from router context instead of the legacy `AuthProvider`, which is deleted.
- Edit video, delete video, pin comment and the admin link render through `useCan`; no role comparison in a
  component.
- No `dangerouslySetInnerHTML` anywhere in `src/`; user text renders as React text.

## Acceptance criteria

- [ ] SSR HTML for a signed-in cookie contains the user's channel name; for no cookie it renders the guest
      header.
- [ ] No `localStorage` token read remains; the cookie is `httpOnly` (asserted on the `signIn` response).
- [ ] A guest opening `/upload` is redirected to `/login?redirect=/upload`, and signing in lands back on
      `/upload` (route spec through `renderRoute` from 54).
- [ ] 401 handling: with a refresh token the request is retried once; without one the session is cleared and
      the user is redirected (specs with MSW).
- [ ] The persona switcher works in dev and is absent from the production build (asserted on build output).
- [ ] Per persona, the admin link and the edit/delete actions show or hide as `@vp/permissions` decides (one
      `it.each` over personas).
- [ ] Zero-matches rows for `dangerouslySetInnerHTML` and `localStorage` token access in `apps/web/src`.
- [ ] `AuthorizedContainer`, `AuthProvider`, `src/auth-token.ts` and `src/layout/components/login/` are gone.
- [ ] `pnpm --filter @vp/web test`, `pnpm typecheck`, `pnpm lint` green; `make smoke-offline` passes.

## Out of scope

- MFA flows.
- Styling the login page and account menu beyond plain markup: [58](58-modern-browse-layout-microinteractions-motion.md).
- The XSS and privilege-escalation browser suite: [75](75-fullstack-e2e-playwright-security-perf-validation.md).
- Admin route guards: [61](61-admin-control-panel-category-moderation-ui.md).

## Open questions

- The browser still needs the token for API calls. Default: the browser calls the API through a same-origin
  server route that attaches the bearer from the cookie, so the token is never readable. The alternative is
  the API accepting the session cookie directly, which needs credentialed CORS from 49. Decide in the PR and
  record it in SDD §11.

## Definition of Done

- [ ] All acceptance criteria proved with command output in the PR.
- [ ] SDD §11 and `apps/web/AGENTS.md` describe the session model.
- [ ] Ticket status set to `done` and `python3 docs/tickets/gen-index.py` re-run.
