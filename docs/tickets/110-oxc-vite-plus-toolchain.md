# 110: Oxc and Vite+ toolchain - oxlint, oxfmt, Vite Task, the Oxc React Compiler, and the memo cleanup it allows

| Field | Value |
|---|---|
| Phase | 5 — Developer experience & growth |
| Size | L |
| Blocked by | 95 - Design system 2 |
| Blocks | 131, 136 |
| Spec | [SDD §15.2 Toolchain](../SDD.md#152-toolchain) · [SDD ADR-20 Workspace boundaries](../SDD.md#adr-20--monorepo-topology-workspace-boundaries-and-contract-single-sourcing) |

**Status:** ready

> **Why.** The repo wants the fastest and latest toolchain, and the Oxc and Vite+ line is where it moved in 2026. Today
> five tools split the work Vite+ does under one `vp` CLI: Biome lints and formats, Turborepo runs and caches tasks,
> lefthook runs the hooks, an esbuild script bundles the two servers, and `viteReact()` runs without a compiler. The
> last one costs code: `@vp/ui` and the apps hand-write 24 `useMemo`, `useCallback` and `memo` calls, which
> react-conventions rule 5 allows only because the React Compiler is off.
>
> This ticket moves the toolchain in one PR, in this order:
>
> 1. **Vite+** (`vp`, Vite 8, Vitest 5, Rolldown, tsdown, oxlint, oxfmt, Vite Task) through the official `vp migrate`.
> 2. **oxfmt** and **oxlint**, type-aware, replace Biome.
> 3. **Vite Task** replaces Turborepo; `vp pack` replaces the esbuild bundle script; `vp staged` replaces lefthook.
> 4. The **Oxc React Compiler** in both apps, `@vp/ui` and the workbench, with a guard that catches bailouts and
>    miscompiles (it is experimental, and the owner accepts that).
> 5. The **memo cleanup** the compiler allows, and the React 19 API simplifications that fall out of it.
>
> **What the repo does not need from this ticket.** `tsc` stays the typecheck: [94](94-typescript-7-native-toolchain.md)
> owns TypeScript 7 and is independent (see Decisions). Playwright, `bun test`, Vitest as the runner, Storybook, tsx and
> knip stay (see "What stays").

## Research

Checked on 2026-10-26; the implementer re-checks every version on the day (`npm view <pkg> version`), since these tools
move monthly.

| Tool | Version found | Date | Status | Source |
|---|---|---|---|---|
| Vite+ (`vp`) | 1.0 stable; the migrate guide names 1.4.0 as its example | stable reported 2026-09-28 (sources differ); beta from 2026-06 | stable, MIT, no account; VoidZero joined Cloudflare in 2026-05 and the projects stay MIT | [viteplus.dev](https://viteplus.dev) · [CI guide](https://viteplus.dev/guide/ci) · [InfoQ](https://infoq.com/news/2026/10/cloudflare-viteplus-stable) |
| Vite Task (`vp run`) | ships in Vite+ | 2026 | stable with Vite+; no documented remote cache or affected-only run | [run guide](https://viteplus.dev/guide/run) |
| Vite | 8 (Rolldown as the bundler); the repo is on 8.3.4 | 2026-03 | stable | [VoidZero, March 2026](https://voidzero.dev/posts/whats-new-mar-2026) |
| Vitest | 5.0.5 re-exported by `vite-plus`; the repo is on 5.0.3 | 2026-08 (rc.4), stable since | stable | [Vite+ migrate guide](https://viteplus.dev/guide/migrate) · [Vitest v5](https://viteplus.dev/guide/vitest-v5) |
| Oxlint | 1.78.0 (newest found) | 2026-08-10 | stable since 1.0 (2025-06-10) | [Oxc blog](https://oxc.rs/blog/2025-06-10-oxlint-stable) · [releases](https://releasebot.io/updates/oxc/oxc) |
| Oxlint type-aware (`oxlint-tsgolint@7`) | 7.0.2000, 59 of typescript-eslint's 61 type-aware rules | 2026-07-22 | stable, opt-in; tracks TypeScript 7.0.2 and runs on its own engine, not on the repo's `typescript` | [Oxc blog](https://oxc.rs/blog/2026-07-22-type-aware-linting-stable) |
| Oxlint JS plugins | alpha since 2026-03-11, docs still say alpha; the `react-hooks` plugin passes ESLint's own tests | 2026-03 | alpha; no type-aware rules, no custom parsers | [Oxc blog](https://oxc.rs/blog/2026-03-11-oxlint-js-plugins-alpha) · [docs](https://oxc.rs/docs/guide/usage/linter/js-plugins) |
| Oxlint rules | 871 rules, 111 on by default | 2026 | stable | [rules](https://oxc.rs/docs/guide/usage/linter/rules.html) |
| Oxfmt | 0.63.0 (newest found) | 2026-08-10 | beta (0.x): 100% of Prettier's JS and TS conformance tests, `--migrate biome` exists, `overrides` do not migrate | [Oxfmt beta](https://oxc.rs/blog/2026-02-24-oxfmt-beta) |
| Oxc React Compiler (`oxc-transform-react`) | 0.144.0 per the announcement | 2026-08-18 | **experimental**, opt-in; `@vitejs/plugin-react@^6.1.0` with `compiler: true`; the Oxc team keeps porting its TODOs | [Oxc blog](https://oxc.rs/blog/2026-08-18-react-compiler-support) · [plugin-react README](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/README.md) |
| Oxlint compiler rules | 22 React Compiler-powered rules (most in `correctness` with the react plugin) | 2026-08 | stable rules on the experimental compiler; `config`, `gating`, `fbt` and `memoized-effect-dependencies` are not implemented | same Oxc blog post |
| tsdown | 0.23 (what Vite+ builds on) | 2026 | 0.x; `vp pack` | [release v0.23.0](https://github.com/rolldown/tsdown/releases/tag/v0.23.0) |
| TypeScript | 7.0 (Go compiler) | 2026-07-10 | stable; no stable programmatic API until 7.1, which is why ticket 94 waits | [InfoQ](https://infoq.com/news/2026/08/typescript-7-released/) |
| `vp migrate` | handles Vite, Vitest, oxlint, oxfmt, tsdown, tsup, ESLint, Prettier; does **not** touch Biome, Turborepo or lefthook | 2026 | stable | [migrate guide](https://viteplus.dev/guide/migrate) · [migrate rules](https://viteplus.dev/guide/migrate-rules) |

Read before starting, in this order: [the Vite+ full guide](https://viteplus.dev/llms-full.txt) ·
[guide](https://viteplus.dev/guide) · [migrate](https://viteplus.dev/guide/migrate) ·
[migrate rules](https://viteplus.dev/guide/migrate-rules) · [Vitest v5 in Vite+](https://viteplus.dev/guide/vitest-v5) ·
[Vitest migration](https://vitest.dev/guide/migration/) · [tsdown 0.23](https://github.com/rolldown/tsdown/releases/tag/v0.23.0) ·
[Vite+ upgrade](https://viteplus.dev/guide/upgrade). The implementer reads them before the first command: this ticket
orders the steps and names the repo's decisions, the guides own the flags.

## Inventory today

From the real files, 2026-10-26.

| Job | Tool and version | Where |
|---|---|---|
| Package manager | pnpm 12.10.1 (no catalog; `pnpm-workspace.yaml` lists `apps/*/*`, `packages/*/*`, `tools/*` and `allowBuilds`) | root `package.json` |
| Lint | Biome 2.5.15, `recommended` plus 6 rules, `--error-on-warnings` | `biome.json`, `pnpm lint` |
| Format and import order | Biome 2.5.15 (2 spaces, 100 columns, single quotes, `es5` commas) and its `organizeImports` | `biome.json`, `pnpm format` |
| Typecheck | TypeScript 6.0.3, `tsc --noEmit` per package plus `tsc -p tsconfig.repo.json` | every package, `typecheck:repo` |
| Library build | `tsc -p tsconfig.build.json` (39 packages) | package scripts |
| Server bundle | esbuild 0.28.2 through `scripts/bundle-entrypoints.ts` | api and worker `build`, `scripts/bundle-app.sh`, `Dockerfile` |
| Client build and dev | Vite 8.3.4 with `@vitejs/plugin-react` 6.1.2 (`viteReact()`, no compiler), TanStack Start, `@tailwindcss/vite` | `packages/server/vite-preset/src/client-app-config.ts` |
| Test runner | Vitest 5.0.3 (about 70 `vitest*.config.ts`, projects at the root); `bun test` on Bun 1.4.2 for runtime parity | root `vitest.config.ts`, `bunfig.toml` |
| Browser and visual | Playwright 1.64 (apps, workbench visual job, `tests/browser`); Storybook 10.6 on `@storybook/react-vite` with `addon-vitest` and `addon-a11y` | `packages/client/workbench` |
| Task runner and cache | Turborepo 2.11.7 (`build`, `typecheck`, `test`, `typecheck:repo`), cached in `.turbo/cache` through `actions/cache`; `turbo prune` in the `Dockerfile` | `turbo.json`, `ci.yml`, `Dockerfile` |
| Dead-code check | knip 6.41 (`knip` and `knip --production`, 231-line config) | `knip.json` |
| Script runner | tsx 4.23 for every script, CLI, migration and seed; Node 24.15 | root scripts |
| Git hooks | lefthook 2.2: `pnpm typecheck` and `biome lint --staged` on pre-commit | `lefthook.yml` |
| Contracts | openapi-typescript 7.x in `@vp/api-contracts` | its `build` |
| Dependencies | Renovate (weekly, grouped minor and patch, digest-pinned actions) | `renovate.json` |
| Release | image builds on tags (`images.yml`), `docker-bake.hcl` | workflows |
| Editor | no `.vscode/`, no `.git-blame-ignore-revs` | repo root |
| Architecture pins | `ci-shape-rules.ts` holds the per-job budgets (build 2, lint-typecheck 3, unit 4, unit-bun 6, integration 3, e2e 4, visual 4, terraform 2 minutes; the `unit` job 240 s; `test:architecture` 10 s; critical path 8) and that only `unit-bun` sets up Bun; `zero-matches-rows.ts` fails a `bun <script>.ts`; `doc-commands.test.ts` reads `pnpm <script>` and `make <target>` in every instruction document; `env-key-closure.test.ts` reads workflow env | `tests/architecture/` |

Manual memoization, non-test source, counted with `git grep`: 11 `useMemo`, 7 `useCallback`, 6 `memo(` = 24, in
`apps/client/web` 14, `@vp/ui` 6, `@vp/intl-react` 2, `@vp/queries` 1, `@vp/permissions-react` 1; `apps/client/studio`,
`@vp/forms`, `@vp/api-client` and the universal packages have none. The sites are listed under "The memo cleanup".

## What to build

One PR, built commit by commit in this order. Each commit leaves `pnpm typecheck`, lint, `pnpm test`,
`pnpm test:architecture` and `pnpm knip` green, and updates the architecture rules and docs its change breaks in the same
commit, never after.

### 0. Before the first command

- Record the baseline on a clean `main`: five runs each of `pnpm lint`, `pnpm format --check`-equivalent,
  `pnpm typecheck` (cold and warm), `pnpm test:unit`, `pnpm test:architecture`, `pnpm exec turbo run build` (cold and
  replayed) and the `build`, `lint-typecheck` and `unit` CI jobs from the last five green `main` runs. The medians go in
  the PR body as the "before" column, and the "after" column is measured the same way.
- Read the guides listed under Research.
- Vite 8.3.4 and Vitest 5.0.3 are already past the guide's floor (Vite 7+, Vitest 4+), so no upstream upgrade comes first.

### 1. Vite+ through `vp migrate`

The implementer follows the official flow, in order:

1. Leave the old manifests, lockfile and installed packages in place, so the migrator can detect the original Vitest
   version. Do **not** install `vite-plus` and do not bump Vitest first.
2. From the workspace root only (a monorepo migrates from the root, so catalogs, overrides and the lockfile stay
   consistent), run the target CLI without touching the old deps, and read its help first:
   `pnpm dlx --package=vite-plus@<latest> vp help migrate`, then
   `pnpm dlx --package=vite-plus@<latest> vp migrate --no-interactive`. Never an old `node_modules/.bin/vp`.
3. Resolve every BLOCK finding and rerun. Read every REVIEW finding and manual-migration warning, success or not. The
   migrator does not convert Biome, Turborepo or lefthook; those are commits 3 to 7.
4. Keep the generated "Vitest v4 compatibility" and "tsdown <0.23 compatibility" settings for the first validation.
5. Check what it changed: Vite and test imports use `vite-plus` and `vite-plus/test*`, type augmentations stay on their
   upstream module ids; the migrator's deps, aliases, catalogs and overrides stay (including the pnpm `vite` and `vitest`
   entries); remaining tool config moves into the matching blocks of `vite.config.ts`. `vp dev` and `vp test` are
   built-ins and `vp run <task>` runs a project script.
6. Validate: `vp install`, `vp check`, `vp test`, the browser, coverage and bench suites, `vp build` for both apps, and
   `vp pack` for any library the migrator moved to tsdown, with its consumers checked against the emitted imports and
   declarations. Fix failures without weakening an assertion or dropping coverage.
7. Report: every REVIEW finding and what was done about it.

The repo's rule overrides the guide's "do not commit or push": the implementer commits per this flow and pushes to the
one PR.

Repo-specific care in this commit:

- About 70 `vitest*.config.ts` files and the root `projects` globs stay as they are; the migrator touches imports and
  deps, and the `pnpm test*` scripts keep working beside `vp test` until commit 8 moves CI.
- The `.js`-free relative imports stay: nothing here adds an extension, and the `esm-specifiers` architecture spec stays
  green.
- `packages/server/vite-preset` imports from `vite` and `vitest/config`; the migrator's rewrite is skipped for plugin
  packages, so check that file by hand.
- No new runtime dependency: `vite-plus` and everything it brings are root `devDependencies`, so
  `lockfile-closure.test.ts`, `workspace-closure.test.ts` and the runtime images (which install production deps only)
  are unaffected. The implementer proves it with `make smoke-offline`.

### 2. Vitest v4 compatibility cleanup

After a green baseline, one setting at a time:

- Remove each generated "Vitest v4 compatibility" setting, run the suites it affects, and keep the removal only if the
  same tests pass with no new skips. A setting whose removal changes a result stays, with its reason.
- Keep `perFile: true` coverage thresholds.
- Do the same for the tsdown compatibility settings (`deps.resolveDepSubpath`, `attw.profile: 'strict'`). Keep `strict`
  when node10 or CommonJS support is intended; no package here publishes, so it is dropped only when `vp pack` is used by
  nothing that ships CommonJS.
- The PR body lists every retained setting with its reason (an acceptance criterion).

### 3. oxfmt replaces Biome format, and one reformat commit

- `vp fmt` (oxfmt) with a config that reproduces today's style: 2 spaces, `printWidth` 100, single quotes, semicolons,
  `es5` trailing commas, always-parenthesised arrows, LF. `npx oxfmt@latest --migrate biome` seeds it; `overrides` do
  not migrate, and the ignore list from `biome.json` (`dist`, `docs`, `.agents`, `.claude`, `tests/fixtures`,
  `routeTree.gen.ts`, `packages/client/ui/src/styles/generated`, `tools/hls-test-page/vendor`, and the rest) is copied by
  hand.
- Import ordering, which Biome's `organizeImports` did, moves to oxfmt's import-sorting option. If it cannot reproduce a
  stable order, the gap is stated and the sorted order oxfmt produces becomes the new order.
- CSS (`tailwindDirectives`) and the other file types Biome formatted: the implementer lists which oxfmt formats and
  which it leaves to nobody, and the second list is empty or stated.
- **One reformat commit** holds only the formatter's output, with no hand edit and no config change in it, so a reviewer
  skips it. The next commit adds its SHA to a new `.git-blame-ignore-revs` and the PR notes
  `git config blame.ignoreRevsFile .git-blame-ignore-revs`.
- `pnpm format` and `make format` become `vp fmt`; `pnpm format:check` is `vp fmt --check`. Both are idempotent: a second
  run changes nothing.

### 4. oxlint replaces Biome lint, type-aware

- `vp lint` (oxlint) with `typeAware: true` through `oxlint-tsgolint@7`, `--error-on-warnings` kept (warnings are errors),
  config in `vite.config.ts`'s `lint` block or `oxlint.config.ts`.
- `typeCheck` (oxlint reporting compiler errors) stays **off**: `tsc` is the typecheck until ticket 94.
- Rule parity, from `biome.json` and the 14 `biome-ignore` sites:

| Biome today | oxlint | Gap |
|---|---|---|
| `recommended` preset | `correctness` category plus the `react`, `typescript`, `unicorn`, `import`, `jsx-a11y`, `promise` and `vitest` plugins as the implementer enables them | the implementer diffs the two rule sets once and records every Biome recommended rule with no oxlint twin |
| `noUnusedVariables`, `noUnusedImports` | `eslint/no-unused-vars` (reports unused imports; confirm with a fixture) | none expected |
| `noExplicitAny` | `typescript/no-explicit-any` | none |
| `useConst` | `eslint/prefer-const` | none |
| `noForEach` | `unicorn/no-array-for-each` | none |
| `useSimplifiedLogicExpression` | no match in the rules list | **gap**: dropped, or a JS-plugin rule if it caught real defects (decided in the commit, with the count of past catches) |
| `useLiteralKeys: off` | rule stays off | none |
| `noTemplateCurlyInString` (off in tests) | `eslint/no-template-curly-in-string` with an override | none |
| `noUndeclaredEnvVars` (off for e2e) | no match; the closed env schema already holds it (`env-key-closure.test.ts`, `env-confinement.test.ts`) | **gap**: stays in the architecture suite |
| `useHookAtTopLevel` (`can.tsx`, `live-page.ts`) | `react/rules-of-hooks` | the two `biome-ignore` ranges move to the oxlint disable form or are restructured |
| `noDocumentCookie`, `useSemanticElements`, `noDangerouslySetInnerHtml`, `noImportantStyles` ignores | closest `react`, `jsx-a11y` and `no-restricted-*` rules | each `biome-ignore` is converted to an oxlint disable with the same reason, or deleted when the rule is gone; none is left behind |
| `organizeImports` | oxfmt (commit 3) | see commit 3 |

- Enable the compiler-aware rules (the 22 React Compiler-powered rules and `react/rules-of-hooks`) here, so they show in
  the editor and in `vp check` before the compiler is on (commit 9 relies on them).
- Custom rules: every project rule that must stay is either in `tests/architecture/` (the default; they already run on
  the TypeScript compiler API, which stays on TypeScript 6 until 94) or an oxlint JS plugin. A JS plugin is alpha, so the
  default is the architecture suite, and a JS plugin needs a reason a spec cannot give (feedback in the editor).
- The `biome-ignore` comments count as machine directives, and the commit converts all 14.
- Delete `biome.json`, `@biomejs/biome`, the `biome` skill under `.agents/skills` and `.claude/skills` if nothing else
  points at it, and every doc line naming Biome (see Docs).

### 5. Vite Task replaces Turborepo

- `turbo.json`'s tasks move to `run.tasks` in `vite.config.ts`: `build` (`dependsOn` the dependencies' `build`, outputs
  `dist/**`, inputs without `*.md`), `typecheck`, `test`, `typecheck:repo` (with the explicit input list it has today),
  `dev` and `test:integration` uncached.
- `pnpm build`, `pnpm typecheck`, `pnpm dev` and the `gen:*` scripts that call `turbo run ... --filter` call
  `vp run` with the same filters (`...pkg` for dependencies).
- CI cache: `actions/cache` of the Vite Task cache directory, keyed the way `.turbo/cache` is today (a `build` job saves,
  the jobs that follow restore), and the same for the typecheck-only cache.
- `turbo prune` in the `Dockerfile` has no Vite Task equivalent. It stays in the `toolchain` stage as a pinned global
  install used for pruning only; `turbo run build` in the image stages becomes `vp run`. `turbo` leaves the root
  `devDependencies`, `turbo.json` and `.turbo` ignores go, `TURBO_TELEMETRY_DISABLED` becomes whatever opt-out Vite+
  documents (or none if it has no telemetry), and the `turborepo` skill is removed if nothing points at it.
- If a measured Vite Task run is slower than turbo on cold or replayed `build` or `typecheck`, the task stays on turbo
  and the PR says so; see Decisions.

### 6. `vp pack` replaces the esbuild bundle script

- `scripts/bundle-entrypoints.ts` (esbuild: bundle, splitting, ESM, Node 24, npm external, `@vp/*` inlined) becomes a
  `pack` block per server app, with the same entries (`main`, `instrument`, and for the api `migrate` and `seed`), the
  same externals rule and `dist/bundle` output.
- `scripts/bundle-app.sh`, `scripts/import-bundle.ts` and the image build keep working on the new output; the worker
  stays dual-runtime (the bundle runs on Bun 1.4 and Node 24) and has no `Bun.*` API in it.
- Library packages keep `tsc -p tsconfig.build.json`: they emit declarations for consumers and are aliased to source in
  every Vite app, so `vp pack` would add a build with no consumer (see Decisions).
- `esbuild` leaves the root `devDependencies` if nothing else imports it (knip says).

### 7. Hooks, editor and DX

- `lefthook` is replaced by `vp config` hooks and a `staged` block in `vite.config.ts`
  (`'*': 'vp check --fix'`-style, plus the repo typecheck the pre-commit runs today). `pnpm prepare` runs
  `vp config`; `lefthook.yml` and `lefthook` go.
- `.vscode/extensions.json` recommends the Oxc extension and Vitest; `.vscode/settings.json` sets Oxc as the default
  formatter and linter for TS, TSX, JSON and CSS, format on save, and turns the Biome extension's settings off. No
  per-developer path or secret goes in either file.
- `Makefile` keeps `lint`, `format`, `typecheck` as one-line wrappers over `vp`; `doctor` checks the `vp` version.

### 8. CI

- A `.github/actions/setup-workspace` that uses `voidzero-dev/setup-vp` pinned by SHA (the guide warns against the `v1`
  tag), with Node from `.nvmrc`, the pnpm store cache it offers and the Vite Task cache, replacing the pnpm and Node
  steps. Bun is still set up only in `unit-bun`.
- `lint-typecheck` runs `vp check` (format check, lint with type-aware rules, and the repo's `tsc` through the task
  runner), then `knip`, `knip --production`, `pnpm boundaries`, `pnpm test:architecture` and `gen:tokens --check`.
- Every job keeps `timeout-minutes` equal to its budget. `BUDGETS` in `ci-shape-rules.ts` is lowered to the measured
  value plus headroom wherever a job got faster, and no row rises.
- `.github/BRANCH_PROTECTION.md` and the ticket README name the required checks; if a check name changes, both change
  with it.
- `renovate.json` pins `vite-plus`, `oxlint`, `oxlint-tsgolint`, `oxfmt`, `oxc-transform-react`, `@vitejs/plugin-react`
  and `tsdown` to exact versions and opens them ungrouped, so a pre-1.0 tool never rides in a grouped minor bump.

### 9. The Oxc React Compiler, and its guard

**Enable.** In `clientAppConfig` (`packages/server/vite-preset/src/client-app-config.ts`), `viteReact({ compiler: true })`
replaces `viteReact()`, with `oxc-transform-react` as a devDependency of the preset, at an exact version. The same
option goes in the test config (`client-app-test-config.ts`, so the specs run the compiled output), in the workbench
(`.storybook/main.ts`'s `viteFinal`, so Storybook and the story tests run compiled) and in `@vp/ui`'s own Vitest configs.
`@vp/forms`, `@vp/queries`, `@vp/intl-react`, `@vp/permissions-react`, `@vp/api-client` and the other client packages
are aliased to source in the apps, so the app build compiles them; their own specs get the same option. A package that
is not aliased to source gets no compiler and says so in its `AGENTS.md`.

**The guard goes in this commit, before any `useMemo` is deleted**, so the cleanup that follows is proven by it. What the
compiler exposes (plugin-react README and `oxc-transform-react`): `logDiagnostics` (plugin option), and in the transform
`reactCompiler.reportDiagnostics` (recoverable diagnostics returned in `errors` with the output still emitted),
`panicThreshold` (`none`, `critical_errors`, `all_errors`), `compilationMode` (`infer`, `syntax`, `annotation`, `all`),
the `"use no memo"` directive (and `customOptOutDirectives`, `ignoreUseNoForget`). It has no `logger` event stream like
`babel-plugin-react-compiler`'s. The guard has five parts:

1. **Bailout report.** `scripts/react-compiler-report.ts` runs the transform with `reportDiagnostics: true` over every
   source file the compiler compiles (both apps, `@vp/ui`, the workbench and the client packages) and prints each
   bailout, unsupported pattern and rules-of-react violation with file, line and reason. A committed
   `tests/react-compiler/baseline.json` lists the allowed ones, each with a reason and an issue link. CI fails on any
   bailout not in the baseline, and on a baseline entry that no longer bails (so it shrinks). The target is an empty
   baseline for `@vp/ui` and the app kits. The report runs as a CI step in `lint-typecheck` through `vp run`, and
   locally as `pnpm react-compiler:report`.
2. **Write-time lint.** The oxlint compiler rules enabled in commit 4 run in the editor and in `vp check`; the report is
   the build-time half, the lint is the write-time half. The unimplemented categories (`config`, `gating`, `fbt`,
   `memoized-effect-dependencies`) are listed in the ticket's Notes so nobody expects them.
3. **Miscompile safety net.**
   - Every suite (the unit and DOM specs, the story tests under `addon-vitest`, and the visual job) runs against the
     compiled output, because commit 9 turns it on for all of them.
   - A differential check: the `@vp/ui` DOM specs for Field, Tabs, Select, Dialog and the upload form
     (`apps/client/studio`) also run in a second Vitest project with the compiler off, and both projects assert the same
     committed snapshot of the DOM and the event trace. A compiled output that differs from the uncompiled one fails one
     of the two.
   - The escape hatch has two levels. Per function or file: the `"use no memo"` directive, allowed only with a baseline
     entry that carries an issue link; an architecture spec fails on a directive with no entry and on an entry with no
     issue link. Per package or app: a `compiler: 'oxc' | 'babel' | false` option on `clientAppConfig`. `'babel'` uses
     `@rolldown/plugin-babel`, `babel-plugin-react-compiler` and `reactCompilerPreset()` from plugin-react, installed as
     devDependencies of the preset at exact versions and exercised by one preset spec that builds a fixture component with
     each of the three modes. Use the directive for one function the Oxc compiler bails out of or miscompiles; use
     `'babel'` for a package where the Oxc compiler breaks more than a few functions; use `false` only while an issue
     for the Oxc compiler is open and no other choice builds. Each use needs the issue link, and the link is the exit
     condition.
4. **Re-render check.** A render-count harness in `@vp/web-testing` (React `Profiler` commits plus a counter on a child
   that the test passes stable props) backs `*.renders.dom.test.tsx` specs for Field, Tabs and Select: a re-render of
   the parent with unchanged inputs commits the child no more than the committed count. They run in the compiled
   project only, because they prove what the compiler provides; a compiler regression that drops memoization fails a
   test, not a profile someone reads.
5. **Version pinning and the upgrade gate.** `oxc-transform-react`, `@vitejs/plugin-react`, `oxlint`, `oxfmt` and
   `vite-plus` are exact versions (no `^`). A Renovate PR for any of them must pass the bailout report and the
   differential check, and the PR template for those bumps says so in one line.

### 10. The memo cleanup

With the compiler on and the guard green, delete every manual memoization it covers.

| Package | Sites to delete |
|---|---|
| `apps/client/web` (14) | `hooks/use-stored-state.ts` (`useMemo`, `useCallback`), `hooks/use-video-pages.ts` (`useMemo`), `category-list.tsx` (`useMemo`, `useCallback`), `all-videos-page.tsx` (`useCallback`), `shared/hooks/useDrag.ts` (2 `useCallback`), and `memo(` on `UserDetails`, `ProfilePicture`, `SubscribeButton`, `VideoCard`, `VideoSettingsDropdown`, `VideosContainer` |
| `@vp/ui` (6) | `appearance/provider.tsx` (the context value), `appearance/media.ts` (`useCallback`), `primitives/avatar`, `callout` and `card` (the shared compound-context `useMemo`), `toast.tsx` (`useCallback`) |
| `@vp/intl-react` (2) | `intl-provider.tsx` (`cacheForLocale`, `bindings`) |
| `@vp/queries` (1) | `session-provider.tsx` (`viewer`) |
| `@vp/permissions-react` (1) | `permissions-provider.tsx` (the CASL ability) |
| `apps/client/studio`, `@vp/forms`, `@vp/api-client`, `@vp/web-telemetry`, universal | none today |

Exceptions, kept only where identity must be stable outside React's render, each with a reason in the baseline file the
guard reads:

- `appearance/media.ts`'s `subscribe` passed to `useSyncExternalStore`: confirm after the compiler runs; if the compiled
  `subscribe` is stable, delete it, else keep it (a changing `subscribe` resubscribes on every render).
- A value handed to a non-React subscriber, or an external store selector, or an effect dependency the compiler cannot
  see through (a ref's `.current`, a value mutated outside render): kept, with the reason.
- `use-stored-state.ts`'s `setValue` if the hook's contract promises a stable setter to a non-compiled caller.

Everything else goes. The guard: an oxlint rule (`react/no-restricted-imports`-style or a JS-plugin rule) is preferred, an
architecture spec in `tests/architecture/` is the default (a `zero-matches` row for `useMemo`, `useCallback` and
`memo(` / `React.memo(` in `apps/client` and `packages/{client,universal}` source, with the allowlist as the exceptions
file). Pick the spec: it needs no alpha plugin and runs in the budgeted suite.

### 11. React 19 API simplification

Only what gets simpler, found with `git grep` on 2026-10-26. Do not churn working code.

| Form | Count and sites | Action |
|---|---|---|
| `forwardRef` | 0 | nothing; a spec guards it |
| `<Context.Provider value>` | 3 contexts: `IntlContext` (`intl-provider.tsx`), `FieldContext` (`field.tsx`), `ToastContext` (`toast.tsx`); the other `.Provider` hits are Radix `Tooltip` and `Toast` providers, which are components, not contexts | `<Context value>` |
| `useContext` | 12 (`drag-scroll-arrow.tsx` x2, `intl-context.ts`, `permissions-provider.tsx`, `api-provider.tsx`, `session-provider.tsx`, `user-event-stream.tsx`, `appearance/provider.tsx`, `ui-copy.tsx`, `field.tsx`, `create-compound-context.ts`, `toast.tsx`) | `use(Context)` only where a hook call after an early return or a branch becomes simpler; otherwise unchanged |
| latest-callback refs (`ref.current = fn`) | 0 found | nothing; `useEffectEvent` is already rule 2 |
| `useRef` | 9, none mirrors a callback | nothing |
| hand-rolled pending or optimistic state | `useState(false)` in `settings-menu.tsx`, `category-list.tsx`, `video-description.tsx`, `useDrag.ts` (2), `theme-menu.tsx`; forms use TanStack Form with `onSubmit`; `persona-switcher.tsx` already uses a form action | read each; change one to `useActionState`, `useOptimistic` or a form action only if it removes code, otherwise leave it and list it |
| `<Activity>` | nothing hidden or kept alive by hand found | nothing |
| document metadata | TanStack Router `head()` in both apps; no helmet | nothing |

The AC counts what is real: zero `forwardRef`, zero `.Provider` on a React context.

## What stays

| Tool | Why it stays |
|---|---|
| Playwright 1.64 | not in the Oxc or Vite+ line; the visual job pins its image by digest |
| `bun test` on Bun 1.4 | the dual-runtime proof (rule 2); `unit-bun` still the only job that sets up Bun |
| Vitest as the runner | Vite+ bundles it (`vp test`); specs keep `globals: true` and `vi.mock(import())` |
| TypeScript 6 and `tsc` | typecheck and library declarations; TypeScript 7 is ticket 94 |
| knip | nothing in Oxc or Vite+ finds unused files, exports or dependencies; knip 6 already parses with `oxc-parser` |
| tsx | scripts run on Node 24 for parity; Vite+ migrates `tsx` only on an optional run, and this ticket does not opt in |
| Storybook 10.6 | already on `@storybook/react-vite`; gets the compiler through `viteFinal` |
| Renovate, Docker, Terraform | outside the toolchain |
| `openapi-typescript` | no replacement; ticket 94 owns its TypeScript 7 problem |

## Acceptance criteria

- [ ] `vp migrate` ran from the workspace root with its findings recorded: each BLOCK resolved, each REVIEW and
      manual-migration warning read and answered in the PR body.
- [ ] Every retained "Vitest v4 compatibility" and tsdown compatibility setting is listed in the PR with a reason, and
      every removal passed the affected suites with no new skip; `perFile: true` coverage thresholds are intact.
- [ ] `vp check`, `vp test`, `vp build`, `vp pack`, the browser, coverage and bench suites are green, and `pnpm
      typecheck`, `pnpm test`, `pnpm test:bun`, `pnpm test:architecture`, `pnpm knip`, `pnpm knip --production` and
      `pnpm boundaries` pass, with output in the PR.
- [ ] Biome, Turborepo (except `turbo prune` in the `Dockerfile`), lefthook and `scripts/bundle-entrypoints.ts` are gone
      from `package.json`, configs, CI, the Makefile and the docs; a `zero-matches` row fails any of them coming back.
- [ ] Lint parity: the table in commit 4 is in the ADR with every gap decided; zero `biome-ignore` remains; `vp lint
      --error-on-warnings` is clean with type-aware rules on, and a fixture proves the type-aware rules fire.
- [ ] oxfmt: one reformat commit holds only formatter output; `.git-blame-ignore-revs` lists its SHA; `vp fmt --check`
      is clean and idempotent.
- [ ] Speed, measured before and after as described in commit 0, with the table in the PR:
      - the `lint-typecheck` job budget drops from 3 minutes to 2, or the PR shows why not and it does not rise;
      - no row of `BUDGETS` in `ci-shape-rules.ts` rises, and each row that got faster is tightened to the new median
        plus headroom; the 8-minute critical path does not rise;
      - lint, format check and the warm repo typecheck are each faster than the Biome and Turborepo baseline on a local
        run, in the PR table;
      - a replayed `build` from the task cache is not slower than turbo's replay.
- [ ] `ci-shape-rules.ts`, `zero-matches-rows.ts` and `doc-commands.test.ts` know the new tools (`vp run`, `vp check`,
      `setup-vp` pinned by SHA); `env-key-closure.test.ts` stays green with any new workflow env.
- [ ] Local-first: nothing in the runtime images or the dev loop reaches a network or an account after install
      (`local-first.test.ts`, `make smoke-offline` green); the implementer checks whether `vp`, oxlint or oxfmt send
      telemetry and sets the documented opt-out in CI and `.env.example`-free config if they do.
- [ ] The `.js`-free import rule holds: `esm-specifiers.test.ts` green, no relative import gained an extension.
- [ ] The React Compiler compiles both apps, `@vp/ui` and the workbench; the bailout report is empty for `@vp/ui` and the
      app kits, and every baseline entry has a reason and an issue link.
- [ ] The guard: the report fails CI on a new bailout and on a stale baseline entry; the differential specs (Field, Tabs,
      Select, Dialog, upload form) pass compiled and uncompiled against the same snapshots; a `"use no memo"` without an
      issue-linked entry fails an architecture spec; the three `compiler` modes build a fixture; compiler packages are
      exact versions.
- [ ] Zero `useMemo`, `useCallback` and `memo` outside the allowlist, enforced by the architecture spec; every exception
      has a reason.
- [ ] Zero `forwardRef` and zero `.Provider` on a React context in source.
- [ ] Render counts: the `Field`, `Tabs` and `Select` render-count specs pass compiled, and the same specs fail when the
      compiler is off (proving they measure it).
- [ ] The whole suite, the story tests and the visual job pass against the compiled output; no snapshot baseline changed
      without a recorded reason.
- [ ] react-conventions rule 5 reads "no manual memo" in `.agents/skills/react-conventions/SKILL.md` and its
      `.claude/skills` copy; the rule 10 API list matches commit 11.

## Docs to update

- `AGENTS.md`, `CLAUDE.md` (root): the toolchain mentions, `Global Commands Quick Reference` (`pnpm lint`, `pnpm format`,
  `pnpm typecheck`, and the new `vp` and report commands), rule 11's speed wording if it names a tool.
- `apps/client/web/AGENTS.md`, `apps/client/studio/AGENTS.md`, `packages/client/ui/AGENTS.md`, `packages/client/AGENTS.md`,
  `packages/server/vite-preset/AGENTS.md`, `packages/client/workbench/AGENTS.md`: the React sections (compiler on, no
  manual memo, the escape hatch and the baseline file), `infra/AGENTS.md` and `tools/AGENTS.md` if they name a removed
  tool. `pnpm sync:claude` keeps the `CLAUDE.md` symlinks.
- `docs/standards/testing.md` (the compiled and uncompiled projects, the render-count harness) and
  `docs/standards/git-workflow.md` (hooks, `.git-blame-ignore-revs`); `docs/standards/file-discipline.md` if the Biome
  line-length wording appears.
- `docs/SDD.md` §15.2 Toolchain (Task runner, Lint/format, Git hooks, Testing rows) and §15.1's `biome.json` tree entry; an
  **ADR-29 Toolchain: Oxc and Vite+** in the SDD that records the old-to-new table, the Decisions below, the lint parity
  table and the experimental-tool risk. `ARCHITECTURE.md` §6 line 502 (Biome) and `README.md`'s command table.
- `.agents/skills/react-conventions` (rule 5, rule 10, `references/modern-apis.md`), and the `biome` and `turborepo`
  skills removed or rewritten (`writing-for-agents` applies). The vendored-skills note in memory is not a repo file.
- `.github/BRANCH_PROTECTION.md` if a required check renamed.

## Out of scope

- TypeScript 7 and `tsgo` for the typecheck (ticket 94), including `oxlint --type-check`.
- A replacement for knip, `tsx`, Playwright, Storybook or `bun test`.
- `tsdown` for library packages, `oxc-resolver` and `oxc-minify` as direct dependencies: Vite 8 and Rolldown already use
  them under the hood, and the repo imports none.
- Rewriting working forms, effects or components for style; only the sites the tables name.
- Moving the visual baselines or the Playwright image.

## Open questions

- Decided: this ticket is blocked by 95. [PR 218](https://github.com/szebest/taitube-platform/pull/218) changes 204 files,
  mostly `@vp/ui` primitives, and this ticket reformats every file, deletes `useMemo` in `@vp/ui` and swaps contexts in
  `field.tsx`: both would conflict file by file, and the Field, Tabs and Select render-count specs need 95's compound
  components to exist. No other open PR blocks it: a branch that predates the reformat commit rebases onto it with one `vp fmt` run.
- Decided: it is not blocked by 94. oxlint's type-aware engine (`oxlint-tsgolint@7`) runs on its own TypeScript 7 build and
  does not need the repo on `typescript@7`, so lint is fast while `tsc` stays on 6. 94 still waits on openapi-typescript
  and the architecture suite's classic compiler API; 110 does not move either.
- Decided: Vite+ first, the rest after it. It bundles oxlint, oxfmt and Vite Task, and `vp migrate` covers Vite, Vitest,
  tsdown and tsup, so the migrator does the bulk once and each later commit replaces one tool by hand.
- Decided: Vite Task replaces Turborepo, with `turbo prune` kept in the `Dockerfile` only. The repo uses `turbo run`
  with filters, `dependsOn` and a GitHub Actions cache, not a remote cache or `--affected`, so Vite Task's gaps (no
  documented remote cache, no affected-only run) cost nothing today, and `vp run` supports the `...pkg` filters and
  `dependsOn: { from: 'dependencies' }`. If commit 5's measurement shows a cold or replayed build slower than turbo, keep
  turbo for tasks and say so in the PR: speed is the point.
- Decided: oxfmt is adopted although it is beta (0.x). Its JS and TS output matches Prettier's tests, the reformat is one
  ignorable commit, and the version is pinned exact. Anything it cannot format (Biome's CSS formatting, if oxfmt does not
  cover it) is listed, not dropped silently.
- Decided: oxlint JS plugins (alpha) are not used for repo rules; the architecture suite stays the home of custom rules.
- Decided: the Oxc React Compiler is on for both apps, `@vp/ui`, the client packages that the apps alias to source and the
  workbench, although it is experimental: the repo is itself experimental, the guard catches what it gets wrong, and the
  fallback is `'babel'` (`babel-plugin-react-compiler`), then `false`, per package.
- Decided: the memo guard is an architecture spec, not an oxlint rule: it needs no alpha plugin, reads an allowlist file
  with reasons, and runs in the budgeted suite.
- Decided: `tsc` keeps emitting library declarations; `vp pack` is used for the two server bundles only.
- Decided: one PR, built commit by commit, as the owner asks; nothing here must be on `main` before another part, so no
  split. The reformat commit and the compiler commit are the two that reviewers can skip or read alone.
- Decided: `lefthook` goes (the migrator leaves it, so the hooks move by hand to `vp staged`).
- Decided: `vp migrate`'s `--full` options (hooks, editor files, agent files) are run only for what this ticket
  wants, and the agent-config files it can write are not written.
- Open for the implementer to decide in the PR, with evidence: whether oxfmt's import sorting reproduces Biome's order;
  whether `useSimplifiedLogicExpression` earned a JS-plugin rule; whether `appearance/media.ts`'s `subscribe` needs to stay.

## Delivery

One PR on `ticket/110-oxc-vite-plus-toolchain`, built in these commits, in this order. The compiler and its guard are
two commits at the end so the guard is on `main` with the compiler.

1. `vp migrate` and its fixes (commit 1 above), then the Vitest and tsdown compatibility cleanup (commit 2).
2. oxfmt, then the reformat commit alone, then `.git-blame-ignore-revs` (commit 3).
3. oxlint, type-aware, with the rule parity table and every `biome-ignore` converted (commit 4).
4. Vite Task for Turborepo, `Dockerfile` and CI cache (commit 5).
5. `vp pack` for the server bundles (commit 6).
6. Hooks, editor and DX (commit 7).
7. CI: `setup-vp`, the new commands, the tightened budgets and the architecture rules (commit 8).
8. The Oxc React Compiler on, and the guard in the next commit with the escape hatch and the render-count harness
   (commit 9).
9. The memo cleanup and its guard (commit 10), then the React 19 API simplification (commit 11).
10. Docs, ADR-29, the SDD toolchain table and the status line.

The PR body carries the before and after timing table, every REVIEW finding, every retained compatibility setting, the
lint parity gaps and the experimental risks. Squash merge title: `110: Oxc and Vite+ toolchain (#<pr_number>)`.

## Notes for the implementer

- The experimental parts are the Oxc React Compiler (0.x, opt-in, Rust port with open TODOs), oxfmt (0.x beta), oxlint JS
  plugins (alpha, unused here) and tsdown 0.x. Oxlint, type-aware linting and Vite+ itself are stable.
- Re-check each version and the unimplemented compiler categories on the day; confirm the Vite+ release date, since the
  sources found disagree.
- Rule 11 of the repo (performance regressions are blocking defects) applies to this ticket's own tools: a step that
  makes a job slower is reverted or explained.

## Definition of Done

- [ ] All acceptance criteria proved with command output in the PR.
- [ ] `docs/SDD.md` §15.2 and ADR-29, `ARCHITECTURE.md`, `README.md` and the AGENTS.md files updated.
- [ ] Ticket status set to `done` and `python3 docs/tickets/gen-index.py` re-run.
