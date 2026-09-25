# AGENTS.md — @vp/tsconfig (TypeScript Presets)

Instructions for any coding agent working on `@vp/tsconfig`.

> Tier rules for this directory: [../AGENTS.md](../AGENTS.md) · full tier & layer reference: [packages/AGENTS.md](../../AGENTS.md)

---

## 1. Scope & Purpose

`@vp/tsconfig` ships JSON presets only — no source, no build step. It is `universal` / T1 because every tier
extends it.

| Preset | Extended by | What it adds on top of `base.json` |
|---|---|---|
| `base.json` | the four presets below and the root `tsconfig.base.json` / `tsconfig.repo.json`; never extended directly by a package | the shared compiler settings (`lib: ["ES2022"]`, `types: []`) |
| `server.json` | every `packages/server/*` package, `apps/api`, `apps/worker` | `lib: ["ES2024"]` (Node 24 and Bun 1.4 both ship it), `types: ["node", "vitest/globals"]` |
| `universal.json` | every `packages/universal/*` package except this one | `lib: ["ES2022", "DOM"]`, `types: []` |
| `client.json` | `packages/client/*` | `lib: ["ES2022", "DOM", "DOM.Iterable"]`, `types: []` |
| `spec.json` | `tsconfig.spec.json` in every `universal` and `client` package, and in `packages/server/env-schema` | the client libs **plus** node/vitest types, `noEmit: true` |

`apps/web` is the one consumer that extends nothing here: it is a Create React App workspace with its own
hand-written `tsconfig.json` (`moduleResolution: "node"`, `jsx: "react-jsx"`). Tickets 49–75 fold it in.

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
- **Adding a preset means adding a tier.** The preset set mirrors `packages/universal | server | client`
  one-for-one, plus `spec`. A new preset without a matching tier is a smell — say why in the PR.
- Every preset listed in `package.json`'s `files` array must exist, and vice versa; the array is what pnpm
  publishes into consumers' `node_modules`.

---

## 3. Changing a preset

A preset change hits every package at once, so:

1. Run `pnpm typecheck` (which runs `pnpm boundaries` first) — not a single-package check.
2. Run `pnpm test:bun` as well when `lib` or `target` moves. Bun and Node disagree about what ES2022 means in
   a few corners, and dual-runtime parity is Rule 2.
3. Record the reason in the PR body. A compiler flag flipped without a stated reason is the kind of thing the
   next reader flips back.
