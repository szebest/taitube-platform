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

`src/__tests__/` is its spec.

## How the check runs it

1. Copies the platform packages it reaches, with their dev closure, to a temp directory, installs them
   offline and builds them.
2. Packs each package it reaches at runtime into `tarballs/kit-<name>.tgz`; `package.json` names its direct
   ones and `pnpm-workspace.yaml` overrides every one, so nothing resolves from a registry.
3. Copies this folder to a second temp directory, installs offline and frozen from `pnpm-lock.yaml`, and
   runs `typecheck` and `test` there. It also fails when an installed package file holds a value of this
   product or names an app package.

The packages ship extensionless relative imports, written for a bundler, so `vitest.config.ts` inlines
`@kit/*` through Vite instead of handing them to Node.

## Changing it

- A new platform dependency: add it to `package.json` as `file:tarballs/kit-<name>.tgz`; the check lists
  the overrides `pnpm-workspace.yaml` then needs.
- Any dependency change: `pnpm check:extractable second-app --refresh-lockfile`. It resolves offline,
  seeded from the repository's lockfile, so every version is one CI's store already holds, and writes
  `pnpm-lock.yaml` back without the tarballs' integrity, which changes with every build.
- The root `.gitignore` ignores every `fixtures/` folder: add a new file with `git add -f`.
