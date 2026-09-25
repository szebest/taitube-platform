# AGENTS.md — @vp/permissions (Pure CASL Declarative Authorization Engine)

Instructions for any coding agent working on `@vp/permissions`.

> Tier rules for this directory: [../AGENTS.md](../AGENTS.md) · full tier & layer reference: [packages/AGENTS.md](../../AGENTS.md)

---

## 1. Scope & Purpose

`@vp/permissions` is the zero-I/O authorization engine built on `@casl/ability`. Universal / T2: it
depends on `@vp/errors` and `@casl/ability` only, so `apps/web`, `apps/api`, `@vp/core`,
`@vp/adapters` and `@vp/domain-rules` all import it.

- Rule factories in `src/rules/`: `defineVideoRules`, `defineCommentRules`, `defineChannelRules`,
  `defineUploadRules`, `defineAdminRules` (`<resource>.rules.ts`).
- The ability builder `getUserPermissions(user: UserContext | null)` in `ability.ts`, which applies all
  five.
- Typed helpers in `src/helpers/`: `canReadVideo`, `canUpdateVideo`, `canDeleteVideo`, `canReactVideo`,
  `canAccessUpload`, `canSubscribeChannel`, `canManageCategory`, `canAccessAdmin`.
- Subject normalizers in `src/normalizers/` (`toVideoSubject`, `toUploadSubject`,
  `normalizeVideoResource`, `normalizeUploadResource`) that the helpers wrap resources with.
- Types in `src/types/`: `UserContext`, `Role`, `parseRole` (the boundary parser from untrusted input),
  the `*Resource` shapes, and `AppAbility` / `AppAction` / `AppSubjects`.
- `assertCan(allowed, { action, subject, user, message })` in `src/errors/assert-can.ts`, which throws a
  `PermanentError` with `UNAUTHORIZED` for an anonymous user and `FORBIDDEN` for a signed-in one. Its
  `Result` form is `authorize` in `@vp/domain-rules`.

---

## 2. Invariants

- Zero I/O and no Node-specific runtime bindings, so it runs under Node 24, Bun 1.4 and the browser.
- Rules, the ability builder and the helpers are pure functions; the package declares no class.
- Callers ask through the `canX` helpers and `assertCan`. The `AppAbility` itself is held by
  `apps/web/src/modules/shared/providers/permissions-provider.tsx` (behind `<Can>`),
  `AuthorizationPort.getAbility()` in `@vp/core/ports` and its two implementations,
  `CaslAuthorizationAdapter` and the in-memory authorization doubles, and
  `packages/server/adapters/postgres/scopes/rules-to-sql.ts`, which turns rules into SQL through
  `@casl/ability/extra`. `@vp/adapters` is the only package besides this one that declares
  `@casl/ability`.

---

## 3. Local Commands

```bash
pnpm --filter @vp/permissions typecheck
pnpm --filter @vp/permissions test
bun test packages/universal/permissions
```
