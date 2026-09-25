# 91: Web app imports on `#app/*` subpath imports - no `src/` alias, no deep relative paths

| Field | Value |
|---|---|
| Phase | 5 — Developer experience & growth |
| Size | S |
| Blocked by | 89 - TanStack Start foundation |
| Blocks | 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 68, 69, 70, 72, 73, 74, 86 |
| Spec | [SDD ADR-21 Frontend framework](../SDD.md#adr-21--modern-frontend-framework-react-19--tanstack-start-ssr--tanstack-router-no-nextjs) · [SDD §1.3 Design principles](../SDD.md#13-design-principles-used-to-break-ties-throughout) |

**Status:** done

> `apps/web/src` reaches the rest of the app three ways today: 82 `src/...` imports resolved by a tsconfig
> `paths` entry plus a matching Vite alias, 138 relative imports three or more levels up (`../../../`) and 37
> two levels up. Every frontend ticket after 89 moves or adds files in `apps/web`, so this goes first, while it
> is one mechanical PR and not a conflict in each of theirs.

## What to build

- One alias, declared once, in `apps/web/package.json` `"imports"`: `#app/*` maps to `./src/*`. TypeScript
  (`moduleResolution: bundler`), Vite, Vitest and the SSR build all read it natively, so the tsconfig `paths`
  entry and the `src` Vite alias are deleted. The workspace package source aliases stay.
- The rule, in `apps/web/AGENTS.md`: `#app/...` for anything outside the current feature folder, `./` and at
  most one `../` for a close sibling. No `src/...` import, no `../../` or deeper. No `.js` extension, ever.
- Every offending import in `apps/web` (source, specs, `vite/`, configs) rewritten by an AST codemod over the
  TypeScript compiler API, not by a regex over code: imports, re-exports, dynamic `import()`, `import()` types
  and `vi.mock`/`vi.doMock`/`vi.importActual` paths.
- The SCSS `@import "src/styles/abstract/..."` lines lose the alias with it: Sass resolves them from a
  `loadPaths` entry pointing at `src`, the way `index.scss` already imports `styles/main`.
- Two zero-matches rows hold `src/` imports and `../../`-or-deeper imports in `apps/web` at 0.

## Acceptance criteria

- [x] `apps/web` has 0 imports from `src/...` and 0 relative imports two or more levels up; both are
      zero-matches rows in `tests/architecture/zero-matches-web-rows.ts`.
- [x] `apps/web/tsconfig.json` has no `paths`/`baseUrl`, and `apps/web/vite.config.ts` no `src` alias.
- [x] `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:architecture`, `pnpm knip`, `pnpm knip --production`
      and `pnpm boundaries` green.
- [x] `pnpm --filter @vp/web build` builds the client and SSR bundles, and the route tree has no drift.
- [x] The dev server serves `/` and `/watch/<id>` server-rendered.
- [x] `apps/web/AGENTS.md` documents the convention; nothing else still documents the `src/` alias.

## Out of scope

- Renaming or moving folders under `src/`: the feature tickets own their structure.
- Subpath imports in the shared packages: they are reached by package name.

## Open questions

- Decided: `#app/*`, not `#/*`. TypeScript 5.9.3 (the installed version) refuses a specifier that is `#` or
  starts with `#/` (`loadModuleFromImports` returns "Invalid import specifier ... has no possible
  resolutions"); only TypeScript 6 accepts it. Vite 7.3 and Vitest 3.2 would have taken either.
- Decided: the `#app/*` target is an array, `./src/*` first and then `./src/*.ts`, `./src/*.tsx`,
  `./src/*/index.ts`, `./src/*/index.tsx`. Vite reads only the first target and probes extensions and
  `index` itself; TypeScript does not probe an `imports` target and walks the array until a file exists.
  Node would stop at the first target, but nothing runs `src` under plain Node - every consumer goes through
  Vite.
- Decided: SCSS keeps its own resolution (`css.preprocessorOptions.scss.loadPaths`), not `#app/`. Vite's
  Sass importer strips everything after `#` as a URL fragment, so `@import "#app/..."` resolves to the
  importing file itself and the build fails with "This file is already being loaded". 55 removes SCSS anyway.
- Decided: the enforcement is the two zero-matches rows only, not also a biome `noRestrictedImports` rule, so
  the rule lives in one place.
