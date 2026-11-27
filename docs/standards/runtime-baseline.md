# Runtime Baseline: the ECMAScript level, the browser floor and the guard

One level per tier, one browser floor, and a check that holds each. Nothing in a package restates them.

## 1. The level per tier

| Tier | `target` | `lib` | Preset |
|---|---|---|---|
| `server` (`packages/server`, `apps/server`, `tsconfig.repo.json`) | `ES2025` | `ES2025` | `@kit/tsconfig/server.json` |
| `universal` | `ES2024` | `ES2024`, `DOM` | `@kit/tsconfig/universal.json` |
| `client` (`packages/client`, `apps/client/web`, `apps/client/studio`) | `ES2024` | `ES2024`, `DOM` | `@kit/tsconfig/client.json` |
| specs of `universal` and `client` packages | `ES2024` | `ES2024`, `DOM`, node and vitest types | `@kit/tsconfig/spec.json` |
| the web service worker (`apps/client/web/tsconfig.sw.json`) | `ES2024` | `ES2024`, `WebWorker` | its own `lib`: `lib` replaces, it does not merge |

`universal` is the lowest common denominator, because it runs in both a browser and a server. A package never sets `target`
or an ES `lib` of its own. `tests/architecture/ecmascript-baseline.test.ts` resolves every tracked `tsconfig*.json` through the
TypeScript API and fails on one that differs from its tier; its table is `tests/architecture/ecmascript-baseline.ts`.

## 2. The rule

`lib` must not be newer than the lowest supported runtime ships, unless the use is guarded by a feature check
(`typeof X === 'function'`) or polyfilled. The lib level is chosen from the floor, never the floor from the lib.

## 3. The browser floor

The floor is the `browserslist` field of the root `package.json`, with explicit versions. It is the one source:

- `clientAppConfig` in `@kit/vite-preset` turns it into the esbuild target through `browserslist-to-esbuild`, for
  `build.target` of the client environment, and hands the same list to the service worker build (`injectManifest.target`).
  The preset reads the field from the consuming app's directory and holds no version of its own.
- The lint guard (section 4) names the APIs the floor lacks.

Chosen from Baseline "widely available" data on 2026-11-10 (`baseline-browser-mapping`): Chrome and Edge 124, Firefox 125, Safari
and iOS Safari 17.4, Chrome and Firefox on Android 124 and 125. Samsung Internet 27 is in the same data and is not a row of
the floor. No analytics source backs the numbers: they are Baseline's, not a business decision about the oldest browser we serve.

## 4. The guard

| What | Gate |
|---|---|
| An ES built-in newer than the tier's lib (`Set.prototype.union`, `Promise.try` on a client) | `pnpm typecheck` fails: the lib does not type it. `scripts/__tests__/client-lib-ceiling.test.ts` proves it on a fixture |
| A DOM or Web API the floor lacks | `lib.dom.d.ts` is not versioned, so `house/guard-newer-apis` (`lint.config.ts`, `scripts/lint-plugin/index.ts`) fails `pnpm lint --deny-warnings` on a use in `packages/{universal,client}`, `packages/platform/{universal,client}` and `apps/client` unless the same file checks `typeof` of that API or calls it as `api?.(...)`; `'x' in obj` is not accepted. The bare global (`requestIdleCallback`) counts as `window.requestIdleCallback` |

`eslint-plugin-compat` runs under oxlint `jsPlugins` and reads the same `browserslist`, but its table has no entry for
`document.startViewTransition`, `Intl.DurationFormat` or `Promise.try`, so it cannot be the guard. The rule's `apis` list is
short and by hand: add an API to it when the floor lacks it.

## 5. Moving the floor or a level

1. Change `browserslist` (or the preset's `target` and `lib`, and the table in `tests/architecture/ecmascript-baseline.ts`).
2. Re-read the `apis` list in `lint.config.ts`: an API the new floor ships comes off it, one it lacks goes on.
3. Re-read the lib members below, and run `pnpm typecheck` and `pnpm lint`.
4. Build web and studio and compare against `entryBudgetKb` and `initialBudgetKb`.

## 6. Lib members above the floor today

Checked against `@mdn/browser-compat-data` 8.1.11 on 2026-11-27, against Chrome 124, Firefox 125, Safari 17.4:

| Member | Lib | Ships in | Above the floor on |
|---|---|---|---|
| `ArrayBuffer.prototype.resize` | ES2024 | Chrome 111, Firefox 128, Safari 16.4 | Firefox |
| `Atomics.waitAsync` | ES2024 | Chrome 90, Firefox 145, Safari 16.4 | Firefox |
| `Set.prototype.union` and the other Set methods | ES2025 | Chrome 122, Firefox 127, Safari 17 | Firefox |
| `Iterator.from`, iterator helpers | ES2025 | Chrome 122, Firefox 131, Safari 18.4 | Firefox, Safari |
| `Promise.try` | ES2025 | Chrome 128, Firefox 134, Safari 18.2 | all three |
| `RegExp.escape` | ES2025 | Chrome 136, Firefox 134, Safari 18.2 | all three |
| `Float16Array` | ES2025 | Chrome 135, Firefox 129, Safari 18.2 | all three |
| `Intl.DurationFormat` | ES2025 | Chrome 129, Firefox 136, Safari 18.4 (ticket text) | all three |

The ES2025 rows are not in the client lib, so typecheck refuses them there; the two ES2024 rows are in it and are not gated by
anything, so guard them with a feature check. The data lists Safari 16.4 for `Intl.DurationFormat`, which contradicts the 18.4
the ticket records; the row uses 18.4 and the data is not trusted for that member. `Object.groupBy` (Safari 17.4) and
`Promise.withResolvers` (Safari 17.4) are why the floor is not lower.

## 7. Node and Bun

`Dockerfile` uses `node:24-slim` and `oven/bun:1.4-slim`; `engines.node` is `^24.15.0`, `.nvmrc` is `24.15`, CI pins Bun 1.4.2.
`tests/architecture/runtime-versions.test.ts` holds the Node major and the Bun minor equal across them. The ES2025 level of the
server tier is proven on both runtimes by `packages/platform/server/testing/src/__tests__/es2025-runtime.test.ts`
(`pnpm test` and `pnpm test:bun`). If a runtime lacks a feature, the whole server tier stays at ES2024: a worker image is
chosen at build time, so no server package may use what only one runtime has.
