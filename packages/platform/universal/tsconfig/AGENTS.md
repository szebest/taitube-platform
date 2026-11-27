# AGENTS.md — @kit/tsconfig (TypeScript Presets)

Instructions for any coding agent working on `@kit/tsconfig`.

> Tier rules for this directory: [../AGENTS.md](../../../universal/AGENTS.md) · full tier & layer reference: [packages/AGENTS.md](../../../AGENTS.md)

---

## 1. Scope & Purpose

`@kit/tsconfig` ships JSON presets only — no source, no build step. It is `universal` / T1 because every tier
extends it.

| Preset | Extended by | `target` / `lib` | Also sets |
|---|---|---|---|
| `base.json` | the four presets below and the root `tsconfig.base.json`; never extended directly by a package | neither | the shared compiler settings (`types: []`, strictness, `moduleResolution`) |
| `server.json` | every `packages/server/*` package, `apps/server/api`, `apps/server/worker`, and the root `tsconfig.repo.json` | `ES2025` / `["ES2025"]` | `types: ["node", "vitest/globals"]` |
| `universal.json` | every `packages/universal/*` package except this one | `ES2024` / `["ES2024", "DOM"]` | `types: []` |
| `client.json` | `packages/client/*`, `apps/client/web`, `apps/client/studio` | `ES2024` / `["ES2024", "DOM"]` | `types: []` |
| `spec.json` | `tsconfig.spec.json` in every `universal` and `client` package | `ES2024` / `["ES2024", "DOM"]` | node and vitest types, `noEmit: true` |

The web service worker (`apps/client/web/tsconfig.sw.json`) is the one config that writes its own `lib`
(`["ES2024", "WebWorker"]`, no DOM), because `lib` replaces and does not merge.

`apps/client/web` extends `client.json` too, adding `jsx: "react-jsx"` and the `vite/client` types. It declares no
`paths`: its `#app/*` imports resolve through the `"imports"` field of its `package.json`.

A package's own `tsconfig.json` adds `rootDir` / `outDir` / `include` and excludes its specs; a sibling
`tsconfig.build.json` extends it and excludes `__tests__`, `__mocks__` and `*.test.ts` from the emitted
build. There is **no** `build.json` preset in this package.

---

## 2. Invariants

- **`base.json` is the single place strictness is declared.** It sets `strict: true` and
  `noUncheckedIndexedAccess: true`. `strict` already implies `noImplicitAny`, `strictNullChecks` and the rest
  of the strict family, so do not re-declare them; `exactOptionalPropertyTypes` is **not** on and turning it
  on is a repo-wide change, not a preset tweak.
- **`moduleResolution` is `bundler`, not `nodenext`.** That is what keeps every relative import
  extensionless (`./thing`), which `esm-specifiers.test.ts` requires in every tier.
- **`types: []` on `universal` and `client` is load-bearing**, and by itself is not enough. The vitest
  globals a spec uses pull `@types/node` back into the program and `node:fs` starts resolving again — which is why those packages exclude their specs from `tsconfig.json` and typecheck them
  through `tsconfig.spec.json` instead. Do not "fix" a `Cannot find name 'process'` error in a universal
  package by adding `node` to `types`; that error is the boundary working.
- **`target` and `lib` belong to the preset, per tier, and a package never overrides them.** `lib` must not be newer
  than the lowest supported runtime ships, unless the use is guarded by a feature check or polyfilled; the lib level is
  chosen from the browser floor, never the floor from the lib. The standard, the floor and how to move either:
  [docs/standards/runtime-baseline.md](../../../../docs/standards/runtime-baseline.md).
  `tests/architecture/ecmascript-baseline.test.ts` fails on a tsconfig whose resolved level differs from its tier's.
- **Adding a preset means adding a tier.** The preset set mirrors `packages/universal | server | client`
  one-for-one, plus `spec`. A new preset without a matching tier is a smell — say why in the PR.
- Every preset in `package.json`'s `exports` map must exist, and vice versa; the map is what a consumer's
  `extends: "@kit/tsconfig/<preset>.json"` resolves through. The package has no api snapshot: `gen:api` skips a
  package whose exports are all JSON.

---

## 3. Changing a preset

A preset change hits every package at once, so:

1. Run `pnpm typecheck` (which runs `pnpm boundaries` first) — not a single-package check.
2. Run `pnpm test:bun` as well when `lib` or `target` moves: the server preset's ES2025 level is proven on both
   runtimes by `packages/platform/server/testing/src/__tests__/es2025-runtime.test.ts`, and dual-runtime parity is Rule 2.
3. Record the reason in the PR body. A compiler flag flipped without a stated reason is the kind of thing the
   next reader flips back.
