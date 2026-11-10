# 172: One ECMAScript baseline per tier - presets, a browser floor, a guard, and the cleanup it enables

| Field | Value |
|---|---|
| Phase | 5 - Developer experience & growth |
| Size | M (one PR, ordered commits, see *Delivery*) |
| Blocked by | 85 - Universal intl and message core · 110 - Oxc and Vite+ toolchain |
| Blocks | — |
| Spec | [packages/universal/tsconfig/AGENTS.md](../../packages/universal/tsconfig/AGENTS.md) · [packages/AGENTS.md](../../packages/AGENTS.md) · [SDD ADR-23](../SDD.md#adr-23--package-runtime-tiers-the-directory-is-the-tier) · [testing.md, dual runtime](../standards/testing.md) · [170](170-platform-packages-open-closed-extractable.md) · [171](171-intl-formatters-open-extensible-list-more-tooltip-and-duration-conformance.md) |

**Status:** ready

> **Owner decision (final).** The `server` tier targets **ES2025** (`target` and `lib`). `client`, `universal`, the specs
> and the apps (web, studio, the web service worker) target **ES2024**. `universal` is the lowest common denominator
> because it runs in both.

## Why

The ECMAScript level is declared in one place and obeyed in almost none. Measured on `main` (2026-11-10):

- `packages/universal/tsconfig/base.json` sets `target: ES2022` and `lib: ["ES2022"]`; `server.json` sets `lib: ["ES2024"]`
  (target stays ES2022); `universal`, `client` and `spec` set `lib: ["ES2022", "DOM"]`. No preset sets its own `target`.
- **25 `tsconfig*.json` files override the preset to `lib: ["ES2023", ...]`** (finding F1), and `tsconfig.repo.json` does
  too. The preset's ES2022 is a dead letter: the real level is whatever each package pasted. The code already relies on
  ES2023 (`toSorted` in `apps/client/web/src/features/offline/utils/list-saved-videos.ts`, `findLastIndex` in
  `watch-liner-notes.tsx`) and ES2024 (`Promise.withResolvers` in `apps/server/api/src/plugins/__tests__/abort-mid-request.ts`).
- There is **no browser floor**. No `browserslist`, no `build.target` in `packages/server/vite-preset/src/client-app-config.ts`
  or either app config, so Vite 8.3.4 applies its own default `'baseline-widely-available'`, which in the installed
  `vite/dist/node/chunks/node.js` is `chrome111, edge111, firefox114, safari16.4, ios16.4`. That floor is older than the
  ES2024 lib the client will compile against: `Object.groupBy` and `Promise.withResolvers` need Safari 17.4 (VERIFY, MDN).
  The bundle is downleveled to a floor nobody chose and the types promise more.
- Nothing stops a client file from calling an API newer than any floor: `lib.dom.d.ts` is not versioned, so TypeScript
  cannot help there. The one guarded use today, `typeof document.startViewTransition !== 'function'` in
  `packages/client/ui/src/appearance/provider.tsx:63`, is a habit, not a rule.
- The trigger: `packages/universal/intl/src/intl-cache.ts:86`, "The ES2022 lib has no Intl.DurationFormat, and older
  engines ship none." The comment is wrong on both halves (the effective lib is ES2023, and the reason it still holds is
  the browser floor), and a reader cannot tell which fact to trust.
- `tests/architecture/program.ts` and `runtime-code.ts` hard-code `ScriptTarget.ES2022` / `lib.es2022.d.ts`, a third
  copy of the level, so a server file using an ES2024 built-in reads as an error type inside the architecture program.

## What to build

1. **Per-tier presets**, each setting `target` and `lib` itself (the shared `base.json` keeps neither):

   | Preset | `target` | `lib` | Used by |
   |---|---|---|---|
   | `server.json` | `ES2025` | `["ES2025"]` | `packages/server/*`, `apps/server/*`, and `tsconfig.repo.json` (scripts, tests, tools run on Node) |
   | `universal.json` | `ES2024` | `["ES2024", "DOM"]` | `packages/universal/*` |
   | `client.json` | `ES2024` | `["ES2024", "DOM"]` | `packages/client/*`, `apps/client/web`, `apps/client/studio` |
   | `spec.json` | `ES2024` | `["ES2024", "DOM"]` + node and vitest types | specs of `universal` and `client` packages |
   | service worker (`apps/client/web/tsconfig.sw.json`) | `ES2024` | `["ES2024", "WebWorker"]`, no DOM | `src/sw.ts` |

   `packages/server/env-schema/tsconfig.spec.json` stops extending `spec.json` and extends `server.json` (it is a server
   package: its specs must see the same level as its source). Every per-package `lib` and `target` override is deleted
   (F1); the only `lib` a package config may still write is the service worker's, because `lib` replaces, it does not merge.
2. **A browser floor, one source.** Root `package.json` gets a `browserslist` field, explicit versions, no moving
   target. Proposal from Baseline data: `baseline-browser-mapping@2.11.34` (already in the lockfile, via `browserslist`)
   run with `getCompatibleVersions({ widelyAvailableOnDate: '2026-11-10' })` returns chrome 124, edge 124, firefox 125,
   safari 17.4, safari_ios 17.4, chrome_android 124, firefox_android 125. Proposed:
   `chrome >= 124, edge >= 124, firefox >= 125, safari >= 17.4, ios_saf >= 17.4, and_chr >= 124, and_ff >= 125`.
   **VERIFY before commit 2** (rerun the command, and check Samsung Internet and the market share of the two oldest rows
   against our own analytics if any exist); the numbers above are what the command printed, not a judgement that they
   are the right business floor. `browserslist-config-baseline@0.5.0` was rejected: it is a moving target (last
   published 2025-08-08) and a floor that moves under the lib table is the problem this ticket removes.
3. **Vite derives its target from it.** `clientAppConfig` sets `build.target` (and the same value for the SW build) from
   the `browserslist` field through `browserslist-to-esbuild@2.1.1` (peer `browserslist: *`; Vite 8 takes the same
   `chrome124` / `safari17.4` / `ios17.4` strings as its own default list). VERIFY in commit 0 that Vite 8 (Oxc) accepts
   the output and that `vite-plugin-pwa@2.0.0` `injectManifest` honours it for `sw.ts`; if it does not, pass the target
   through its `injectManifest` build options and assert it in a spec.
4. **The rule.** `lib` must not be newer than the lowest supported runtime ships, unless the use is guarded by a
   feature check (`typeof X === 'function'`) or polyfilled. Corollary: the lib level is chosen from the floor, never the
   floor from the lib.
5. **The guard** (*Guard* below), **the server gate** (*Server ES2025*), **the DurationFormat decision**, **the cleanup**
   (*Cleanup findings*) and **the docs** (*Docs*).

## Guard: client and universal code cannot use an API newer than the floor

Evaluated against what the repo runs (lint is oxlint through `vp lint`, `lint.config.ts`; no ESLint is installed):

| Option | Covers | Verdict |
|---|---|---|
| TypeScript `lib` pinning (ES2024 for client and universal) | every ES built-in newer than ES2024 (`Set.prototype.union`, `Promise.try`, `RegExp.escape`, iterator helpers, `Intl.DurationFormat`): `pnpm typecheck` fails | **Adopt.** Free, already the toolchain, and the preset table test keeps it from drifting |
| `eslint-plugin-compat@7.0.2` (reads `browserslist`, peer `eslint ^9 \|\| ^10`) through oxlint `jsPlugins` | DOM and Web APIs, which `lib.dom.d.ts` never gates, and ES members inside ES2024 that the floor lacks (`ArrayBuffer.prototype.resize`, `Atomics.waitAsync`) | **Adopt if the spike passes.** The peer says ESLint and the repo has none: oxlint's JS-plugin loader must run it. VERIFY in commit 0 |
| An oxlint `no-restricted-properties` / `no-restricted-globals` deny list in `OVERRIDES` for `packages/{universal,client}/**` and `apps/client/**` | the same, by hand, for a short list of tempting APIs | **Fallback** when the spike fails; same mechanism as the existing `no-restricted-imports` row |

The spike (commit 0) is a fixture under `scripts/__tests__/lint-fixtures/` that must fail: `document.startViewTransition(...)`
unguarded (Firefox shipped same-document view transitions after 125, VERIFY on MDN), and must pass: the guarded form in
`provider.tsx`. The result, plugin or fallback, is recorded in the PR body.

## Server ES2025

ES2025 adds, in `lib.es2025.*` of the installed TypeScript 6.0.3: Set methods (`union`, `difference`, `isSubsetOf`, ...),
iterator helpers (`Iterator.prototype.map`, `Iterator.from`), `Promise.try`, `RegExp.escape`, `Float16Array` and
`Math.f16round`, and `Intl.DurationFormat` (`lib.es2025.intl.d.ts`). `ScriptTarget.ES2025` exists (value 12).

**Verified now, per feature**, by running one probe script (`typeof X` for each) on the two runtimes on this machine:
Node v24.10.0 (V8 13.6) and Bun 1.4.2 (the version pinned in `.github/actions/setup-workspace/action.yml`).

| Feature | Node 24.10.0 | Bun 1.4.2 |
|---|---|---|
| `Set.prototype.union` and `isSubsetOf` | yes | yes |
| `Iterator.prototype.map`, `Iterator.from` | yes | yes |
| `Promise.try` | yes | yes |
| `RegExp.escape` | yes | yes |
| `Float16Array`, `Math.f16round` | yes | yes |
| `Intl.DurationFormat` | yes | yes |
| `Error.isError` (ESNext, not in the lib) | yes | yes |

The engines floor is `^24.15.0` (`.nvmrc` 24.15) and this machine runs 24.10.0, so the table is not the gate: **the gate
is a permanent spec, not this table.** `packages/server/testing/src/__tests__/es2025-runtime.test.ts` asserts every
ES2025 member listed above exists, runs under `vitest` (Node, in CI on 24.15) and under `pnpm test:bun` (Bun 1.4.2), and
fails the PR if either lacks one. The spec lives in a `server` package because `pnpm test:bun` runs only
`apps/server`, `packages/universal` and `packages/server`.

**If a runtime lacks a feature, the whole server tier stays at ES2024; there is no per-package split.** Reason: worker
code and the `universal` and `server` packages must run interchangeably on Node and Bun (rule 2), and the worker image is
chosen at build time (`WORKER_RUNTIME=bun|node`), so any server package can land in either. A preset that allowed a
feature on one runtime only would turn a type-clean call into a production crash on the other image. The bump then waits
for the lagging runtime, and the spec's feature list is the single place to re-enable it. Everything else in this ticket
is independent of the server level and still lands.

**Images and pins** (the baseline is only true where the versions are): `Dockerfile` uses floating `node:24-slim` and
`oven/bun:1.4-slim`; `engines.node` is `^24.15.0`, `.nvmrc` is `24.15`, CI pins Bun `1.4.2`. An architecture spec asserts
the three agree on the Node major and the Bun minor, so a major bump in one file fails until the others and the
ES2025 spec are re-read. No digest pinning here (out of scope).

## Intl.DurationFormat

Decision: **the fallback in `duration-fallback.ts` stays.** At the proposed floor (chrome 124, firefox 125, safari 17.4)
no browser ships `Intl.DurationFormat` (Chrome 129, Firefox 136, Safari 18.4; VERIFY on MDN), so the browser path takes
the fallback. On the server tier, Node and Bun both ship it (table above), so the native path is taken there.

Types: the native constructor is typed in `lib.es2025.intl.d.ts` only. `universal` compiles at ES2024, so
`Intl.DurationFormat` has no type in the package that owns the code, and the local `DurationFormatConstructor` plus the
`Intl as { DurationFormat?: ... }` cast in `intl-cache.ts` stay, as the one place a newer-than-lib API is reached, behind
the existing feature check. The comment is rewritten to say that (the universal lib is ES2024 and the floor lacks it),
with no ES level in it. `formatters/duration.ts:8` ("no TypeScript options type yet") is made true or deleted the same way.

**Handed to [171](171-intl-formatters-open-extensible-list-more-tooltip-and-duration-conformance.md)** (which adds the
native-versus-fallback conformance test): (1) the fallback stays and is exercised for real in browsers, so the conformance
test is a permanent guard, not a transition aid; (2) the native side of that test can only run where the lib types it or
through the existing cast, and the runtimes that have it are Node 24 and Bun 1.4 (the spec project, not jsdom's browser
shape); (3) the existing `withoutNativeDurationFormat` helper in `formatters/__tests__/duration.test.ts` stays the way to
force the fallback. 171 is not blocked by this ticket; if the floor rises past Chrome 129, Firefox 136 and Safari 18.4 the
fallback becomes deletable and the ticket that raises the floor owns that.

## Cleanup findings

Greps run on `origin/main` (e3bb23f4 plus the 11 later commits) over `apps`, `packages`, `scripts`, `tools`, `tests`;
each hit below was read. **Commit 0 reruns them** (PR #326 adds code). Left as `[ ]` until done.

- [ ] **F1. Stale per-package `lib` overrides, 25 files plus `tsconfig.repo.json`:** `packages/universal/{intl,messages}/tsconfig.json`
  and `tsconfig.spec.json` (4); `packages/client/{ui,forms,queries,web-telemetry,components,workbench,permissions-react,web-testing,intl-react}/tsconfig.json`
  and `tsconfig.spec.json` (18); `apps/client/web/tsconfig.json`, `apps/client/studio/tsconfig.json` (2);
  `apps/client/web/tsconfig.sw.json` (1, keeps `WebWorker`, ES entry from the table). Delete the `lib` line; the preset owns it.
- [ ] **F2. Architecture program hard-codes ES2022:** `tests/architecture/program.ts:16,21,66,112`, `tests/architecture/runtime-code.ts:29`,
  `tests/architecture/metric-emissions.ts:32`. Take the level from the table module; the shared program spans server code, so it uses ES2025 and no DOM.
- [ ] **F3. Comment and cast naming an ES level:** `packages/universal/intl/src/intl-cache.ts:86` (see *Intl.DurationFormat*). The only comment in the repo naming an ES version.
- [ ] **F4. Hand-rolled `escapeRegExp`, 5 copies.** Server tier, use `RegExp.escape` once ES2025 is gated:
  `packages/server/vite-preset/src/client-app-config.ts:32` (note: #326 edits this file), `scripts/ci-health/margins.ts:33`
  (check `workspace-source-aliases.test.ts` does not compare the regex source: `RegExp.escape` escapes a leading
  alphanumeric as `\x..`). **Stay** (`RegExp.escape` is Chrome 136, Firefox 134, Safari 18.2, above the floor; VERIFY):
  `apps/client/web/src/features/search/utils/matched-terms.ts:16`, `packages/client/web-telemetry/src/start-web-tracing.ts:18`.
- [ ] **F5. Copy-then-sort in production code, use `toSorted`** (ES2023, below the floor, already used in `apps/client/web`):
  `apps/client/studio/src/features/admin/components/category-table/category-table.tsx:184`, `packages/universal/domain/src/notification.ts:88`,
  `packages/universal/domain-rules/src/screening/decide-screening.rule.ts:75`, `apps/server/api/src/services/watch-party/watch-party-invite-candidates.ts:114`,
  `packages/server/vite-preset/src/bundle-guard.ts:23`, `apps/client/web/src/features/search/utils/matched-terms.ts:13`.
  Plus the spec helper `sortedKeys` (`apps/server/api/src/services/watch-party/__tests__/watch-party-role-party.ts:57`) and `sorted` (`packages/universal/domain/src/__tests__/watch-party-roles.test.ts:43`): inline them.
  `comment-own-overlay.ts:28` sorts a fresh array: leave.
- [ ] **F6. Deferred-promise boilerplate, use `Promise.withResolvers`** (ES2024, already used in `abort-mid-request.ts`):
  `packages/server/concurrency/src/__tests__/singleflight.test.ts:3` (a hand-written `deferred<T>()`: delete it),
  `apps/server/api/src/__tests__/serve.test.ts:30-38`, `packages/server/composition/src/__tests__/container.test.ts:140` and `:209`,
  `apps/server/worker/src/stages/__tests__/transcode.test.ts:183`, `apps/client/web/src/features/clips/components/clip-delete/__tests__/clip-delete.dom.test.tsx:39`,
  `apps/client/web/src/lib/query-keys/__tests__/recommendation-feedback-mutations.test.ts:54`, `packages/client/web-testing/src/__tests__/api-server.test.ts:65`.
  `segment-uploader.ts:201` pushes resolvers into an array: not this pattern, leave.
- [ ] **F7. Set difference by hand in specs, use `Set.prototype.difference`** (ES2025, server tier, Node specs; `metrics.test.ts` also runs under Bun):
  `packages/server/observability/src/__tests__/metrics.test.ts:66-67`, `tests/architecture/catalogue-parity.test.ts:22-23`,
  `tests/architecture/env-keys-consumed.test.ts:144`, `tests/architecture/frontend-layers.test.ts:133`.
  **Stay:** `packages/universal/domain-rules/src/playlists/reorder-playlist.rule.ts:19` (`every(... named.has)`): `isSubsetOf` is Chrome 122, Firefox 127, Safari 17, above the floor on Firefox (VERIFY).
- [ ] **F8. Last-element index, use `.at(-1)`** (ES2022, no baseline change; listed because the sweep was asked for):
  `apps/client/studio/src/features/admin/utils/pick-days.ts:11`, `packages/universal/pagination/src/pagination.ts:90`,
  `packages/server/adapters/in-memory/in-memory-storage-client.ts:142`.
- [ ] **F9. Unguarded API above the floor:** none found. The one use of a newer-than-floor DOM API, `startViewTransition` in
  `packages/client/ui/src/appearance/provider.tsx:63`, is guarded.
- **None found** (grepped, read, nothing to remove): `structuredClone` and `JSON.parse(JSON.stringify(` shims; `lodash`, `ramda`,
  `core-js`, `es-toolkit` imports in our source (`es-toolkit` is only a transitive `recharts` dependency, named in the
  `charts` vendor chunk of `client-app-config.ts`); `Array.prototype` / `Object.prototype` polyfills; `groupBy`, `findLast`,
  `at`, `Object.hasOwn` helper re-implementations (the code already calls the natives); `downlevelIteration`,
  `useDefineForClassFields`, `experimentalDecorators`, `importsNotUsedAsValues`, `isolatedModules` flags; a Babel or
  browserslist config; hand-written types for features now in lib other than F3; `as` casts around lib types other than
  F3 (the `as { x?: ... }` hits are job-payload shapes, not lib gaps). The ES2022 examples in `.agents/skills/*/references/`
  are vendored upstream skill text: left alone.

## Docs

- `packages/universal/tsconfig/AGENTS.md`: replace the preset table (it still says `ES2022`, and `server.json` "ES2024")
  with the table above, add the rule (*What to build* 4), say `target` is per preset and `lib` is never overridden in a
  package, and rewrite the "Bun and Node disagree about what ES2022 means" step to point at the ES2025 spec.
- `packages/AGENTS.md`: one paragraph under tiers: each tier's ES level and the link to the standard.
- New `docs/standards/runtime-baseline.md` (no existing standard owns it; `testing.md` owns the dual-runtime proof and
  links to it): the table, the browser floor and where it lives, the rule, how to raise or lower it (change `browserslist`,
  rerun the guard, re-read the lib table, then the budgets), the lib members above the floor today (`ArrayBuffer.prototype.resize`,
  `Atomics.waitAsync`, Set methods, `RegExp.escape`, `Promise.try`; VERIFY each), and the Node and Bun pins. Add it to the
  index in root `AGENTS.md`.
- `Dockerfile` and `.nvmrc`: no content change unless the version-agreement spec exposes a mismatch; the base images are
  referenced, not edited. `infra/AGENTS.md` gets one line pointing at the standard.
- `docs/standards/testing.md` dual-runtime section: add the ES2025 spec as the proof.

## Acceptance criteria

- [ ] **1. Presets.** `server.json` is ES2025 / ES2025; `universal.json`, `client.json`, `spec.json` and the web service worker config are ES2024
  (DOM, or WebWorker for the worker); `base.json` sets neither `target` nor `lib`; `tsconfig.repo.json` extends `server.json`;
  `env-schema`'s spec extends `server.json`. No package config sets `target`; none sets an ES `lib` that differs from its tier (F1 done).
- [ ] **2. Drift test.** `tests/architecture/ecmascript-baseline.test.ts`, with one table module `tests/architecture/ecmascript-baseline.ts`
  (tier directory to `target` and ES `lib`), resolves the effective options of every tracked `tsconfig*.json` through the TypeScript API and fails on a
  difference. Its table also feeds F2. The test is shown red against a fixture preset before the presets change.
- [ ] **3. Floor.** Root `package.json` has `browserslist` with explicit versions, verified per *What to build* 2 (every VERIFY resolved or recorded in the PR body).
  `clientAppConfig` derives `build.target` from it; web, studio and the service worker output are built to it. A `vite-preset`
  spec asserts the resolved `build.target` equals `browserslist-to-esbuild(browserslist)` and that the PWA build gets the same value.
  `pnpm build` for web and studio passes the `entryBudgetKb` and `initialBudgetKb` budgets (a floor above Vite's default can only shrink output; the numbers are recorded before and after).
- [ ] **4. Guard.** The spike's result is in force: either `eslint-plugin-compat` through oxlint `jsPlugins`, or the deny list in `OVERRIDES`; the fixture
  with the unguarded newer-than-floor API fails `pnpm lint --deny-warnings`, the guarded form passes, and `pnpm typecheck` fails on `Set.prototype.union` in a client fixture.
- [ ] **5. Server ES2025.** `es2025-runtime.test.ts` is green under `vitest` and `pnpm test:bun`; the version-agreement spec (Node major, Bun minor across
  `Dockerfile`, `engines`, `.nvmrc`, setup-bun) is green. If either runtime lacked a feature, the server preset stays ES2024, the table says so, and the PR body names the feature and the runtime.
- [ ] **6. Duration.** The fallback stays; `intl-cache.ts` comment and the cast are rewritten per *Intl.DurationFormat*; the handoff paragraph is also posted as a note
  on 171's PR (#333) or its ticket header, not by editing 171 here.
- [ ] **7. Cleanup.** F1 to F8 done or each unchecked item struck with a reason; F9 and the none-found list re-verified at the PR head. Each category is its own commit.
- [ ] **8. Docs.** The five items in *Docs*; `pnpm test:architecture` doc-links and doc-paths specs green; a grep for `ES2022` and `ES2023` outside vendored skills, ticket history and this ticket finds nothing.
- [ ] **9. Proof.** `pnpm boundaries`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:bun`, `pnpm test:architecture` green, output pasted in the PR.

## Delivery

**One PR**, branch `ticket/172-ecmascript-baseline`, ordered commits, no stack; each commit leaves typecheck, lint and tests green:

0. **Recorded checks, no behaviour change:** rerun the *Cleanup findings* greps, run the feature probe on Node 24.15 and Bun 1.4.2, rerun the
   Baseline command, the Vite and `vite-plugin-pwa` target check, and the compat-plugin spike; write the results into the PR body.
1. **Tests first:** `ecmascript-baseline.ts` table and its test (red), `es2025-runtime.test.ts`, the version-agreement spec.
2. **Presets** (one preset per hunk), delete the F1 overrides, point `tsconfig.repo.json` and `env-schema` at `server.json`; fix whatever `pnpm typecheck` now reports.
3. **Floor:** `browserslist`, `build.target`, the SW build, the budget numbers.
4. **Guard** and its fixtures.
5. **Cleanup:** F2 and F3, then F4 to F8, one commit per category.
6. **Docs.**

## Sequencing and overlap

Open PRs, treated as merged (read with `git diff --name-only origin/main...<branch>`):

| PR | Touches that this ticket also touches | Handling |
|---|---|---|
| #326, [136](136-frontend-ui-and-feel-overhaul-web-and-studio.md) (2393 files) | `packages/server/vite-preset/src/client-app-config.ts` (adds `loadEnv`, `optimizeDeps.entries`: same returned object where `build.target` goes), `apps/client/web/vite-pwa.config.ts` (`devOptions`), `apps/client/studio/vite.config.ts` (budget), `package.json`, `docs/standards/testing.md`, the web, studio and vite-preset `AGENTS.md`; new web and studio sources, so the F4 to F8 greps change | start after it merges; commit 0 reruns the greps and the budget numbers; the `vite-preset` hunk is a small rebase |
| #333, [171](171-intl-formatters-open-extensible-list-more-tooltip-and-duration-conformance.md) (docs only: its ticket) | the duration decision; no code | independent; 171's implementation reads *Intl.DurationFormat* here |

**[170](170-platform-packages-open-closed-extractable.md) (ready, not started) is order-independent; landing 172 first is cheaper.**
170 moves `packages/universal/tsconfig` to `packages/platform/universal/tsconfig` as `@kit/tsconfig` and rewrites every `extends`
by codemod; 172 first means the codemod carries presets that are already correct, and 170's start condition ("no other
large ticket in flight") is easier to meet after an M ticket than before. If 170 lands first, this ticket reads the preset
path from 170's package map instead of a literal path (170 commit 2 builds it), and the table lives in the architecture
test, not in the preset package, so `@kit/tsconfig` stays free of app facts and extractable; the `browserslist` is the app's
and stays at the repo root. 170 does not need to be listed as a blocker either way.

## Out of scope

Raising or lowering ES levels beyond the owner's decision; a legacy-browser build or `@vitejs/plugin-legacy`; polyfill
libraries (`core-js`); digest-pinning images; deleting the Intl fallback; rewriting existing `new Set`/`sort` code that is
not one of F4 to F8; CSS browser support (Tailwind and Lightning CSS targets) beyond what `build.target` already feeds.

## Open questions

1. Is the proposed floor (chrome and edge 124, firefox 125, safari and iOS 17.4) the product floor, or does support need an older Safari? Lowering it below 17.4 breaks the ES2024 client decision for `Object.groupBy` and `Promise.withResolvers`.
2. `spec.json` at ES2024 means a `server` package's spec cannot be on it; confirm `env-schema`'s spec moves to `server.json`.
3. Samsung Internet, Opera and UC are not in the proposed list: accept, or add explicit versions?
4. If the compat plugin cannot run under oxlint, is the hand-kept deny list acceptable as the guard?

## Definition of Done

All acceptance criteria checked with output pasted; the Baseline, probe, Vite and spike results are in the PR body; PR
squash-merged as `172: One ECMAScript baseline per tier - presets, a browser floor, a guard, and the cleanup it enables (#NNN)`
after the owner's approval.
