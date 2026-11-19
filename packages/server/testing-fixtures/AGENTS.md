# AGENTS.md — @vp/testing-fixtures (This Product's Spec Fixtures)

Instructions for any coding agent working on `@vp/testing-fixtures`.

> Tier rules for this directory: [../AGENTS.md](../AGENTS.md) · full tier & layer reference: [packages/AGENTS.md](../../AGENTS.md)

---

## 1. Scope & Purpose

`@vp/testing-fixtures` holds what a spec of this product shares and a platform package must not carry. Tier
`server`, `vp.layer` 2; its dependencies are in [package.json](package.json). The generic helpers
(`definePackageTestConfig`, `withEnv`, `expectOk`, `captureLog`) are in `@kit/testing`.

- **`.` (`src/index.ts`):** `SEEDED` (the users, channels and videos the dev seed and every in-memory
  `Repositories` start with) and `createMockJob`.
- **`./env`:** `PRODUCTION_ENV`, a complete production-shaped environment with fake secrets.

Its own `src/__tests__/` also holds the infra specs: compose, the k8s local and cloud overlays, KEDA, the
Grafana dashboards and Terraform, and the sweep that every vitest config restores spies and env vars.

---

## 2. Invariants

- Must execute completely offline without network calls.
- Nothing in production source imports it; it is a dev dependency everywhere but its own manifest.

---

## 3. Dedicated Standards

- **Testing Standards:** `docs/standards/testing.md`

---

## 4. Local Commands

```bash
pnpm --filter @vp/testing-fixtures typecheck
pnpm --filter @vp/testing-fixtures test
```
