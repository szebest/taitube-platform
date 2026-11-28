# Second app

A small bookshop, Quill, that installs the platform packages the way any other product would: from
`pnpm pack` tarballs, never from this workspace. It proves the packages hold none of this product's values
and work with another app's. `pnpm check:extractable second-app` runs it; CI runs it in the `extractable`
job.

It brings its own:

| What | Where | Value |
|---|---|---|
| Error codes | `src/errors.ts` | `SHELF_FULL`, `BOOK_NOT_FOUND` beside the common codes |
| Locales | `src/locales.ts` | `fi-FI`, and `ar-EG` right to left |
| Cookie prefix | `src/appearance.ts` | `quill.look`, `quill.mode` |
| Key namespace | `src/keys.ts` | `quill:` |
| Metric prefix | `src/metrics.ts` | `quill_` |
| Dev-token issuer | `src/dev-token.ts` | `quill-local` |
| Registry | `src/registry.ts` | its error codes and the node runtime |
| Messages | `src/messages.ts` | its own engine, `fi-FI` source, an `ar-EG` translation, a `tally` preset |
| Rules | `src/shop-rules.ts` | its abilities, order machine and field failures |
| Cache | `src/shelf-cache.ts` | a `CacheClient` that runs the `@kit/ports/contract` suite |
| UI copy | `src/shop-ui.tsx` | its Finnish words for the `UiCopy` the platform UI asks for |

It depends on every package under `packages/platform/`, and each is imported and exercised by a spec in
`src/__tests__/`: `universal` (result, primitives, machine, validation, pagination, permissions, appearance,
design-tokens), `server` (config, logger, composition, concurrency, object-storage, compose-autoscaler,
testing, the ports contract), `messages` (i18n, intl), `react-ui` and `react-intl` (ui, components, forms,
intl-react), `web-runtime` (query, security-headers, web-telemetry, web-testing) and `tooling` (tsconfig,
vite-preset). `tsconfig.json` extends `@kit/tsconfig/client.json`.

`@kit/vite-preset` is consumed through its root entry, `./bundle-guard` and `./react-plugins`. The root entry takes
the workspace `packagesDir` as an argument, so an app outside a workspace passes a directory with none of the
tiers and nothing aliases. `./react-plugins` declares `@rolldown/plugin-babel`, `@babel/core` and
`babel-plugin-react-compiler` as optional peers, and the app installs them.

## How the check runs it

1. Builds the platform packages it reaches at runtime in this repository with turbo, which replays the
   build job's cache in CI, while it copies them, with their dev closure, to a temp directory as a
   workspace. Each package's own shard proves it builds outside the repository.
2. Packs each package it reaches at runtime from that copy into `app/tarballs/kit-<name>.tgz`;
   `package.json` names its direct ones and `pnpm-workspace.yaml` overrides every one, so nothing resolves
   from a registry.
3. Copies this folder to `app/` in the same temp directory, installs offline and frozen from
   `pnpm-lock.yaml`, and runs `typecheck` and `test` there. It also fails when an installed package file,
   source maps included, holds a value of this product or names an app package, or when a package it
   reaches was not installed for that scan.

The packages ship extensionless relative imports, written for a bundler, so `vitest.config.ts` inlines
`@kit/*` through Vite instead of handing them to Node.

## Changing it

- A new platform dependency, or a third-party peer one of them asks for: add it to `package.json` as `file:tarballs/kit-<name>.tgz`; the check lists
  the overrides `pnpm-workspace.yaml` then needs.
- Any dependency change: `pnpm check:extractable second-app --refresh-lockfile`. It resolves offline,
  seeded from the repository's lockfile, so every version is one CI's store already holds, and writes
  `pnpm-lock.yaml` back without the tarballs' integrity, which changes with every build.
- The root `.gitignore` ignores every `fixtures/` folder: add a new file with `git add -f`.
