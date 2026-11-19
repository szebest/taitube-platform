# AGENTS.md — @kit/testing (Shared Spec Helpers)

> Tier rules for this directory: [../AGENTS.md](../../../server/AGENTS.md) · full tier & layer reference: [packages/AGENTS.md](../../../AGENTS.md)

---

## 1. Scope & Purpose

`@kit/testing` holds the helpers specs across the repo share. Tier `server`, `vp.layer` 2; its dependencies
are in [package.json](package.json). Each subpath's `import` condition points at `src/`, so a spec needs no
build. The product's own fixtures (the seeded rows, a production-shaped environment, the infra specs) live in
`@vp/testing-fixtures`.

- **`.` (`src/index.ts`):** `definePackageTestConfig` (node environment, globals, `restoreMocks`,
  `unstubEnvs`, `src/**/__tests__/**/*.test.ts`; most package `vitest.config.ts` files build on it, a few
  define their own and set the same two) and `withEnv`.
- **`./result`:** `expectOk` / `expectErr`, which unwrap a `Result` or fail naming what came back.
- **`./jwt`:** `signingKey` and `signJwt`, a throwaway RS256, ES256 or EdDSA key and a token signed with
  it, for the token-verifier and API auth specs.
- **`./log-capture`:** `captureLog`, a `destination` for `createLogger` that parses back what was written.
- **`./run-entrypoint`:** `runEntrypoint`, which starts a TypeScript entrypoint under the runtime the
  spec runs on (`tsx` under Node, as is under Bun).

---

## 2. Invariants

- Must execute completely offline without network calls.
- Carries no product value: no audience, host or id of this product.
- Nothing in production source imports it; it is a dev dependency everywhere but its own manifest.

---

## 3. Local Commands

```bash
pnpm --filter @kit/testing typecheck
pnpm --filter @kit/testing test
```
