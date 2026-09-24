# AGENTS.md — @vp/permissions (Pure CASL Declarative Authorization Engine)

Instructions for any coding agent working on `@vp/permissions`.

> Tier rules for this directory: [../AGENTS.md](../AGENTS.md) · full tier & layer reference: [packages/AGENTS.md](../../AGENTS.md)
---

## 1. Scope & Purpose

`@vp/permissions` provides an isomorphic, pure functional, zero-I/O declarative authorization engine powered by `@casl/ability`.
- Decoupled from `@vp/core` and backend database adapters so both `apps/api` and `apps/web` can import authorization logic without bundle pollution.
- Pure functional rule factories (`video.rules.ts`, `comment.rules.ts`, `channel.rules.ts`, `upload.rules.ts`, `admin.rules.ts`).
- Global ability builder `getUserPermissions(user: UserContext | null)`.
- Library-agnostic typed `canX` action helper functions (`canReadVideo`, `canUpdateVideo`, `canDeleteVideo`, `canAccessUpload`, etc.).
- RFC 9457 assertion adapter `assertCan(allowed, { action, subject, user, message })` strictly distinguishing 401 UNAUTHORIZED vs 403 FORBIDDEN.
- Zod schema validation adapter converting issues into structured `invalidParams`.

---

## 2. Invariants

- Zero I/O and zero Node-specific runtime bindings (100% dual-runtime compatible with Node 24 and Bun 1.4).
- No classes; all policy definitions and ability builders are pure functions.
- Applications must NOT consume raw `@casl/ability` objects directly; consume typed `canX` helpers and `assertCan`.

---

## 3. Local Commands

```bash
pnpm --filter @vp/permissions typecheck
pnpm --filter @vp/permissions test
bun test packages/universal/permissions
```
