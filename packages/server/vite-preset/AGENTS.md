# AGENTS.md — @vp/vite-preset (the Vite config of every client app)

> Tier rules for this directory: [../AGENTS.md](../AGENTS.md) · full tier & layer reference: [packages/AGENTS.md](../../AGENTS.md)

Owner: ticket [89](../../../docs/tickets/89-web-tanstack-start-foundation.md). `server` tier (a Vite config runs in
Node), layer T1. It is build tooling: a client app names it as a devDependency, which `check-boundaries.ts`
allows across tiers (`BUILD_TOOLING`), and nothing of it reaches a bundle.

## What it holds

`clientAppConfig({ configUrl, port, forbiddenDirs })`, which an app's `vite.config.ts` default-exports:

- the TanStack Start plugin (file routes, `__tests__` ignored), React and Tailwind; a `test` mode loads React
  alone, so Vitest never starts the route crawler;
- the React Compiler, through `reactPlugins(compiler)` in `src/react-plugins.ts` (`@vp/vite-preset/react-plugins`,
  which the client packages' Vitest configs and the workbench's `viteFinal` call too): `'oxc'` by default
  (`oxc-transform-react`), `'babel'` (`babel-plugin-react-compiler` through `@rolldown/plugin-babel`) for a package
  the Oxc port breaks, `false` only while an Oxc issue is open and nothing else builds; each use but `'oxc'` names
  its issue. `compilerDiagnostics` is what `pnpm react-compiler:report` reads, with the build's own options.
  The compiler packages are exact versions: `oxc-transform-react` stays inside the range `@vitejs/plugin-react`
  declares (0.156.0 for 6.2.1). `clientAppTestConfig({ compiler: false, include })` builds the uncompiled
  project a differential spec runs in;
- the workspace source aliases: every `packages/{universal,client}/*` package resolves from `src/index.ts`, so
  an edit hot-reloads the app; a `"./x/*"` export pattern becomes one alias, its capture substituted into the
  source path, and its source directory must exist;
- Sass `loadPaths` at the app's `src/`, and the dev and preview port, strict;
- the bundle guard on the client build: no devtools in a production chunk, no `demo-personas/` folder in one built without
  `VITE_DEMO_PERSONAS=true` (read with `loadEnv`), none of its `forbiddenDirs` (code that moved to another app) in any chunk, every route in a chunk
  of its own, no `process.env` read, no module in two chunks, an entry chunk within its `entryBudgetKb` (gzip), and
  no `vendor-player` or `vendor-charts` chunk among the entry's static imports;
- the `vendor-*` chunks (`react`, `tanstack`, `dnd`, `forms`, `player`, `charts`), so vendor code keeps its hash across a deploy.

## Rules

- **One module.** Vite loads an app's config with this package left external, so Node imports
  `src/client-app-config.ts` itself and cannot resolve an extensionless relative import. Keep it one file and
  its spec one file.
- **No app knowledge here.** A rule one app needs (a forbidden module) is an option
  the app passes, never a path written into this package.
- **Not here:** runtime code, test helpers (`@vp/web-testing`), anything that reads an app's `src/config`.

```bash
pnpm --filter @vp/vite-preset typecheck
pnpm --filter @vp/vite-preset test
```
