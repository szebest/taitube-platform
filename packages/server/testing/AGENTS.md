# AGENTS.md — @vp/testing (Shared Test Fixtures & Utilities)

Instructions for any coding agent working on `@vp/testing`.

> Tier rules for this directory: [../AGENTS.md](../AGENTS.md) · full tier & layer reference: [packages/AGENTS.md](../../AGENTS.md)
---

## 1. Scope & Purpose

`@vp/testing` holds the helpers specs across the repo share. Tier `server`, `vp.layer` 2; depends on
`@vp/result` and `vitest`. Each subpath's `import` condition points at `src/`, so a spec needs no build.

- **`.` (`src/index.ts`):** `definePackageTestConfig` (the vitest config every package's
  `vitest.config.ts` builds on: node environment, globals, `src/**/__tests__/**/*.test.ts`), `FIXTURES`
  (the seeded video and user ids, a `traceparent`), `createMockJob` and `withEnv`.
- **`./result`:** `expectOk` / `expectErr`, which unwrap a `Result` or fail naming what came back.
- **`./jwt`:** `signingKey` and `signJwt`, a throwaway RS256, ES256 or EdDSA key and a token signed with
  it, for the token-verifier and API auth specs.
- **`./env`:** `PRODUCTION_ENV`, a complete production-shaped environment with fake secrets.
- **`./log-capture`:** `captureLog`, a `destination` for `createLogger` that parses back what was written.
- **`./run-entrypoint`:** `runEntrypoint`, which starts a TypeScript entrypoint under the runtime the
  spec runs on (`tsx` under Node, as is under Bun).

Its own `src/__tests__/` also holds the infra specs: compose, the k8s local and cloud overlays, KEDA, the
Grafana dashboards and Terraform.

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
pnpm --filter @vp/testing typecheck
pnpm --filter @vp/testing test
```
