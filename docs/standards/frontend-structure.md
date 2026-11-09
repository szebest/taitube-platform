# Frontend Structure

How `apps/client/web` and `apps/client/studio` are laid out, what each folder may import and what a file is called.
Both apps follow the same rules. The kits they share live in `packages/client/ui` and `packages/client/components`
([design-system.md](design-system.md)); the tiers and layers of the packages are [packages/AGENTS.md](../../packages/AGENTS.md).
Ticket [131](../tickets/131-frontend-folder-structure-names-and-boundaries.md) introduced the shape.

---

## 1. The top level of an app

```
apps/client/<app>/src/
  routes/          TanStack file routes, thin: params, validateSearch, loader, head, and a page component that
                   only lays features out. A page's layout of more than a screen of JSX goes in routes/-components/<name>/
                   (the router ignores the dash). Nothing imports routes.
  features/<domain>/   one folder per domain; index.ts is its public face, the rest is private
  components/<area>/<name>/   the app kit: presentational, used by two or more features
  hooks/           React hooks two or more features use
  utils/           pure helpers two or more features use
  lib/             the app's own code with no third-party SDK at its edge: config/, query-keys/, player/ (the port)
  integrations/    adapters at a third-party or platform edge: devtools/, query/, video-js/, service-worker/
  __tests__/       app-level test helpers (providers, loader-api)
  router.tsx  start.ts  routeTree.gen.ts    TanStack reads these by path, they stay at the root
```

A folder is created when its first file exists, never empty: studio has no `integrations/` and web has no `utils/`
until something needs one.

`lib/` and `integrations/` differ by one question: does the file import a third-party package or a browser API at its
edge? Yes: `integrations/`, where a spec stubs the SDK and a swap changes only that folder. No: `lib/`. Code both apps
need goes to a `packages/client/` package, never a copy.

| | Web | Studio |
|---|---|---|
| Features | `account` `browse` `channel` `clips` `embed` `library` `live` `notifications` `offline` `pwa` `recommendations` `search` `shell` `shorts` `watch` | `account` `admin` `analytics` `captions` `channel` `comments` `live` `shell` `team` `upload` `videos` |
| Kit areas | `channel` `discovery` `discussion` `feed` `live` `player` `settings` `shell` `shorts` `states` `video` `watch` | `analytics` `dialogs` `live` `table` `team` `video` `workspace` |

The player is not a feature: the skin is `components/player/`, the Video.js engine `integrations/video-js/`, the port
`lib/player/`.

---

## 2. Import direction

A layer imports only the layers below it.

```
routes -> features, components, hooks, utils, lib, integrations
features -> components, hooks, utils, lib, integrations
components -> hooks, utils, lib, integrations
hooks, utils -> lib, integrations, utils
integrations -> lib
lib -> lib
```

- **A feature never imports another feature**, not through its `index.ts` either. When two must talk, a route composes
  them (one's output into the other's props, a slot or a callback), or the shared piece moves down to `components/`,
  `hooks/`, `utils/`, `lib/` or a `packages/client/` package. Server state two features share goes through a key factory
  in `lib/query-keys/` (or `@vp/queries` when both apps use it), never through the other feature's query options.
- **A route imports a feature only through its `index.ts`.**
- **A file imports its own feature by relative path**, never `#app/features/<itself>`.
- **No import cycles** under `src/`. `routeTree.gen.ts` is generated and ignored by lint.

| Rule | Held by |
|---|---|
| No feature into another feature, no kit, hook, util, lib or integration into a feature, every feature has an `index.ts` | `tests/architecture/frontend-layers.test.ts` (resolves alias and relative imports, `import()` and `vi.mock`) |
| A route reaches a feature through its `index.ts` | oxlint `no-restricted-imports` on `apps/client/*/src/routes/**`, specs excepted |
| No cycles | oxlint `import/no-cycle` on `apps/client/*/src/**` |
| Folder names, stories and specs placement, stylesheets | `tests/architecture/frontend-folder-shape.test.ts` |
| Component folders hold their story, spec and `index.ts` | `tests/architecture/component-folders.test.ts` |
| One spec per source file | `tests/architecture/test-correspondence.test.ts` |
| No file byte-identical between the apps | `tests/architecture/client-app-duplicates.test.ts` |
| A public face with nothing unused | `pnpm knip` |

---

## 3. A component folder

The shape of a `@vp/ui` primitive, of a `@vp/components` component, of an app's kit and of a feature's components:

```
video-card/
  video-card.tsx            the component, one per file
  video-card.variants.ts    its tv() styles, only when it has variants (static classes stay inline)
  video-card.context.ts     compound components only
  index.ts                  the folder's public face
  types.ts  constants.ts    when needed
  components/<name>/        its subcomponents, each in this same shape
  hooks/use-x.ts            hooks only this component uses
  utils/x.ts                helpers only this component uses
  __tests__/                specs, one per source file: video-card.dom.test.tsx
  __stories__/              video-card.stories.tsx
```

- Helpers, hooks, constants and shared types do not live in the `.tsx` of a component: pure helpers go to the nearest
  `utils/`, stateful blocks to `hooks/use-x.ts`, constants to `constants.ts`. The nearest is the component's own folder,
  then the feature's, then the app's when two features use it.
- Stories sit at the component folder, never in a subcomponent. A subcomponent is shown by its parent's stories.
- Specs stay one per source file and beside it ([testing.md](testing.md)): `hooks/use-x.ts` has
  `hooks/__tests__/use-x.test.ts`. A route spec stays in `routes/__tests__/`.
- A feature-private component folder is imported by file path; `index.ts` is required at a feature root and at a kit or
  package component root.
- Styling is Tailwind and the tokens of `@vp/ui`, plus a `<name>.variants.ts` when classes follow a prop. No `.scss`,
  no CSS module, no Bootstrap; the one stylesheet an app may own is `styles/app.css`.

---

## 4. Names

| Thing | Rule | Example |
|---|---|---|
| File and folder | kebab-case; route files keep TanStack's `$`, `_`, `.` and `__root` | `video-card/video-card.tsx` |
| Component | PascalCase export, file and folder its kebab-case | `VideoCard` in `video-card.tsx` |
| Hook | file `use-<thing>.ts`, export `use<Thing>`, only in a `hooks/` folder | `use-watch-progress.ts` |
| Util | verb-first camelCase export, file its kebab-case | `format-duration.ts` exports `formatDuration` |
| Constant | `constants.ts`, SCREAMING_SNAKE | `IN_VIEW_LOCAL_STORAGE_KEY` |
| Spec | `<source-stem>.test.ts` (node), `<source-stem>.dom.test.tsx` (jsdom) | `use-watch-progress.test.ts` |
| Story | `__stories__/<component>.stories.tsx` | `video-card.stories.tsx` |
| Query file | `api/<feature>-queries.ts`, keys beside | `channel-queries.ts` |
| Forbidden folder names | `pages/`, `modules/`, `shared/`, `common/`, `misc/` | |

---

## 5. Adding things

- **A feature**: `features/<domain>/` with an `index.ts` that exports what routes need (page-level components, the
  loader's query options, a hook a route calls) and nothing else. Reach another domain through a route or a lower layer.
- **A component**: `pnpm gen:component <name> --kind primitive|shared|web|studio [--area <area>] [--compound]` writes the
  folder above with its spec and story.
- **Something two features use**: move it to the app's `components/`, `hooks/`, `utils/` or `lib/`; something both apps
  use goes to a `packages/client/` package.
- **A move of folders** ships alone, in its own PR or slice ([git-workflow.md](git-workflow.md) section 2).
