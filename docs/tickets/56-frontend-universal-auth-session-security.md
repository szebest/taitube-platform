# 56: Frontend universal auth, session security & XSS / token hardening

| Field | Value |
|---|---|
| Phase | 5 — Developer experience & growth |
| Issue | [#56](https://github.com/szebest/taitube-platform/issues/56) |
| Size | M |
| Blocked by | 38 — User identity · 54 — Frontend testing infrastructure · 55 — Modern design system |
| Blocks | 60, 61, 75 |
| Spec | [SDD §11 Security](../SDD.md#11-security) · [SDD §6.1 Endpoints](../SDD.md#61-endpoints) |

**Status:** blocked

## What to build

The legacy frontend stored sensitive tokens directly in `localStorage` without XSS sanitization, depended exclusively on Facebook OAuth, and had no clean session renewal or RBAC role awareness in the UI.

This ticket delivers enterprise-grade frontend authentication and security:
1. **Universal Auth Integration**:
   - Seamless compatibility with standard OIDC/JWKS providers (Clerk, Supabase, Auth0, or local dev tokens).
   - Local offline dev mode: One-click "Login as Dev User" / "Login as Admin" when running in `NODE_ENV=development`.
2. **Secure Token & Session Management**:
   - Defense-in-depth token handling: Access tokens held in memory with silent refresh via `httpOnly` secure cookies or refresh handlers.
   - Automatic 401 token refresh interceptor: transparently refreshes expired tokens before retrying queued requests.
3. **Frontend Permission Directives & `useCan` Hook**:
   - Import typed `canX` action helpers (`canUpdateVideo`, `canDeleteVideo`, `canPinComment`, `canManageCategory`) directly from `@vp/permissions` (`@taitube/permissions`).
   - Pure functional integration: provide lightweight `useCan(helperFn, params)` hook without `@casl/react` or class bloat.
   - UI seamlessly shows/hides edit, delete, pin, and moderation actions based on current user role and resource attributes.
   - Strict ban on manual hand-checks (`if (user.role === 'admin')`) in UI components.
4. **XSS & Content Security Hardening**:
   - Strict DOMPurify sanitization on all rendered user comments and video markdown descriptions.
   - Elimination of `dangerouslySetInnerHTML` anti-patterns.

## Acceptance criteria

- [ ] Auth provider context (`AuthProvider`) supporting login, logout, user profile, and current token.
- [ ] Dev bypass toolbar rendered only in development mode enabling instant switching between Guest, Normal User, Creator, and Admin personas.
- [ ] Centralized Axios/fetch interceptor handling 401 expiration and refreshing without forcing full-page reloads.
- [ ] `useCan` hook and functional permission guards integrated with `@vp/permissions` typed helpers.
- [ ] UI action buttons (Edit Video, Delete Video, Pin Comment, Admin Panel link) conditionally render via `useCan(canX, ...)` with zero hand-written role comparisons.
- [ ] User input sanitization: Video descriptions and comment bodies sanitized against script injection and hostile iframe exploits.
- [ ] Unit tests testing `useCan` authorization rendering across all user personas.

## Out of scope

- Multi-factor authentication (MFA) UI flows.

## Notes for the implementer

- Do not store unencrypted JWT tokens with long expiry in `localStorage`.
- Provide zero-config development auth out of the box so any developer can clone the repository, run `pnpm dev`, and immediately interact as any persona.

## Testing plan

- Security test: Inject malicious `<script>` and `javascript:alert(1)` payloads in comment bodies and verify clean rendering.
- Role test: Assert Admin persona sees Admin Panel link, standard user sees only personal channel options.

## Definition of Done

- [ ] `pnpm --filter @taitube/web test` passes.
- [ ] Security audit and linter check pass with zero XSS vulnerabilities.
- [ ] Architecture and decision docs updated (`ARCHITECTURE.md`, `docs/SDD.md` and ADRs if boundaries, packages or contracts changed).
- [ ] Ticket status set to `done` and `python docs/tickets/gen-index.py` re-run.
