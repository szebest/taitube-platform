# 131: Front-end folder structure, names and boundaries, web and studio

| Field | Value |
|---|---|
| Phase | 5 - Developer experience & growth |
| Size | L |
| Blocked by | 59 - Watch page · 60 - Creator studio dashboard · 61 - Admin control panel · 62 - Remove the legacy frontend · 72 - Settings · 73 - Playlists and library · 95 - Design system 2 · 99 - Notifications · 103 - Comment hearts and inbox · 110 - Oxc and Vite+ toolchain · 111 - Captions and transcripts |
| Blocks | 136 |
| Spec | [95 section 7 and 8, the app kits](95-design-system-2.md) · [design architecture, how a component is shaped](../design/architecture.md#4-how-a-component-is-shaped) · [packages/AGENTS.md](../../packages/AGENTS.md) · [testing.md](../standards/testing.md) · [git-workflow.md](../standards/git-workflow.md) |

**Status:** blocked

> **Why.** The two client apps, web (`apps/client/web`) and studio (`apps/client/studio`), grew three structures side
> by side, and every rule below holds for both. Web's `src` has `features/` (73 files), a legacy `modules/` (62 files,
> PascalCase folders, `pages/` inside each), a `hooks/` and a `components/` of its own, and 30 `.scss` files from before
> [95](95-design-system-2.md)'s Tailwind and token system, with Bootstrap still loaded in `__root.tsx`. Studio repeats the
> shape in 65 files: `features/` (16), a legacy `modules/` (19) that imports the features, a `layout/` that holds its
> shell, `studio.css` and two CSS modules, and `react-bootstrap` forms. Features reach into each other (11 imports among
> web's features today, 2 edges in studio, plus the legacy modules', listed below), a component is a flat file in one
> feature and a folder in the next, stories sit beside the component in one package and nowhere in another, and the
> same wrapper exists twice, once per app. Every new page ticket picks a shape, so the mess grows with each one.
>
> This ticket runs after the current front-end batch (the last 95 PR, 59, 60, 61, 62, 72, 73 and the UI halves of 99,
> 103 and 111) and after [110](110-oxc-vite-plus-toolchain.md), which reformats the repo: moving files before the
> reformat would put every conflict of 110 on top of every move. It gives both apps one structure, writes it down,
> and makes the tools refuse the old one.

> **Order with 62.** [62](62-frontend-performance-virtualization-ssr-bundle-hardening.md) deletes `modules/`,
> `styles/`, every `.scss` and Bootstrap, so by the time this ticket starts the legacy half of the "today" map below is
> gone. The map is recorded as of `main` now so the target can be checked against what exists; slice 1 re-surveys
> before it moves anything.

## Today (main, 2026-10-27)

```
apps/client/web/src                 208 tracked files
  routes/            28   file routes plus __tests__; thin, mostly
  features/          73   auth browse channels feed home player reactions search shell subscriptions videos watch
  modules/           62   LEGACY: SubscriptionVideos Subscriptions UserPage VideoPage shared (PascalCase, pages/ + components/)
  components/         9   route-fallbacks.tsx, shell/app-shell/ (the one 95-shaped folder)
  hooks/              4   use-stored-state, use-video-pages
  integrations/       4   devtools/, query/restore-query-data
  config/             2   env reader (Zod)
  styles/ + index.scss  15 .scss, modules/**: 15 *.module.scss   LEGACY
  __tests__/          7   app test helpers
apps/client/studio/src               65 tracked files
  routes/            16   file routes plus __tests__: /, /login, _authed, /upload, /upload/edit/$videoId, /videos/$videoId/analytics
  features/          16   analytics(2) auth(4) upload(4: api, hooks) videos(6: components, forms, hooks)
  modules/           19   LEGACY: Analytics (a page) and Upload (upload-page, edit-page, video-form edit/upload, upload-progress)
  layout/             2   studio-shell.tsx (the logo, account menu, theme menu, link back to web) and its spec
  components/         2   route-fallbacks.tsx and its spec
  config/             2   env reader (Zod)
  studio.css + modules/**: 2 *.module.css   LEGACY styles; react-bootstrap in 3 sources
  __tests__/          4   app test helpers (providers, router, routeTree, start)
  hooks/ integrations/ styles/ lib/ utils/ assets/   absent
```

What is wrong, measured:

- **Two homes for pages.** `modules/<Name>/pages/<name>-page` and `routes/*.tsx` both hold page code; `features/home`
  and `features/search` hold a page component too.
- **Components have no shape.** `features/auth/components/account-menu.tsx`, `features/player/components/control-bar.tsx`
  and `features/shell/components/*.tsx` are flat files with their specs in a shared `__tests__/`; `browse` and `home`
  use folders; `shell-destinations.tsx` and `sidebar-state.ts` sit loose at the feature root.
- **Stories.** `@vp/ui` (40) and `@vp/components` (8) keep `<name>.stories.tsx` beside the component, as 95 specifies;
  `web` has 1 and studio none; nothing says where an app's go. 95's kits and 60's studio pages add dozens.
- **Studio's own shape problems.** The upload and edit pages live in `modules/Upload/pages/`, away from their routes in
  `routes/_authed/upload/`; `layout/` is a second name for the kit, where 95 puts `StudioWorkspace`; the two metadata
  forms sit in `modules/Upload/components/video-form/{edit,upload}/` while their validators sit in
  `features/videos/forms/`; the features are flat files (`retention-chart.tsx`, `account-menu.tsx`) with specs in a shared
  `__tests__/`; `config/` and `components/route-fallbacks.tsx` repeat web's.
- **Cross-feature imports, web** (the list this ticket breaks, with the way each goes):

| Importer | Imports | Breaks by |
|---|---|---|
| `home`, `search`, `watch` | `browse`'s `VideoCard`, `VideoGrid`, `VideoGridSkeleton` | they are presentational and three features use them: they live in web's kit, `components/video/`, which is where 95 section 7 already puts `VideoCard` |
| `browse` (trending feed) | `feed`'s `publicFeedQueryOptions` | `feed`, `home` and `browse` are one domain, discovery: one `browse` feature |
| `subscriptions` | `feed`'s `feedKeys`, `channels`' `channelQueryOptions` | a key another feature invalidates lives in the app's `lib/query-keys/` (`feedKeys`, `channelKeys`), imported by both sides; the subscription feed query moves into `library`, where its page is |
| `videos` (delete) | `feed`'s `feedKeys` | same `lib/query-keys/` |
| `shell` | `auth`'s `AccountMenu` | `RootShell` takes the account menu as a slot prop; `__root.tsx` composes `<RootShell accountMenu={<AccountMenu />}>` |
| `watch` | `player` (a lazy import) | the player is shared by the watch page, Shorts ([102](102-shorts.md)) and clips ([105](105-clips.md)): it moves down, skin to `components/player/`, the Video.js engine to `integrations/video-js/`, the port to `lib/player/` (the bundle guard keeps the lazy chunk) |
| `shared` components (legacy `SubscribeButton`, `VideoSettingsDropdown`, `VideoLikes`) | `subscriptions`, `videos`, `reactions` | dies with 62; the replacements are feature components the route passes into a kit slot (`ChannelHeader`'s action slot, `VideoCard`'s actions slot, `EngagementBar`'s like slot) |
| legacy `modules/*` pages | `channels`, `feed`, `watch`, `subscriptions` | dies with 62; the route composes |

- **Cross-feature imports, studio.** `modules/Upload` imports `videos` (validators, components, hooks) and `upload`
  (the transfer type and hook); `layout/studio-shell.tsx` imports `auth`'s `AccountMenu`. Break: the upload route's
  page component renders `videos`' metadata form and hands it the `upload` hook's state through props; the workspace
  takes the account menu as a slot, like the shell. Studio has no other cross-feature edge today; 60, 61 and 99 add
  `admin`, `notifications` and a library, so the isolation rule is what keeps them from growing one.
- **Duplicated between the apps** (the byte-identical guard cannot see these, they differ by a line or two):
  `features/auth/components/login-page.tsx` (2 lines differ, a copy key), `account-menu.tsx` (6, the studio link),
  `components/route-fallbacks.tsx` (9), `config/index.ts` (10, the sibling app's URL), `__tests__/providers.tsx`
  (49), and `router.tsx` and `start.ts` (identical, but TanStack reads them by path).
- **Styling.** 30 `.scss` in web, 15 of them global (`index.scss`, `styles/main`, `styles/abstract/*`,
  `styles/base/_base`, `styles/components/*`) and 15 `*.module.scss` under `modules/`; Bootstrap CSS, Bootstrap Icons
  and `react-bootstrap` in 3 web and 3 studio sources; studio has `studio.css` and 2 `*.module.css`; `@vp/forms` has
  `file-field.module.css`. `sass`, `bootstrap`, `bootstrap-icons` and `react-bootstrap` are still dependencies.
- **Files that do too much** (lines, today; 59, 60, 61 and 95 change several before this runs, so slice 1
  re-measures): `components/shell/app-shell/app-shell.tsx` 298 (95 splits it), `player/components/control-bar.tsx` 171,
  `player/telemetry/playback-tracker.ts` 153, `player/components/settings-menu.tsx` 136,
  `shell/shell-destinations.tsx` 112 (data and components in one file), studio `upload-video-form.tsx` 140.

## Target

Every client app has the same top level. A folder's name tells what may live in it and what it may import.

```
apps/client/<app>/src/
  routes/          TanStack file routes, thin: params, validateSearch, loader, head, and a page component that
                   only lays features out. -components/ (ignored by the router) holds a page's layout when it is
                   more than a screen of JSX. Imports features (through their index.ts), components, hooks, utils,
                   lib, integrations. Nothing imports routes.
  features/<domain>/   one folder per domain; isolated. index.ts is its public face; the rest is private.
    index.ts  types.ts  constants.ts
    api/          query options and mutations' server calls   hooks/   utils/   forms/
    components/<name>/   the component folder shape below
    __tests__/    specs of the feature's own composition, when there are any
  components/<area>/<name>/   the app kit (95 section 7 and 8): presentational, used by two or more features
  hooks/           React hooks two or more features use            (use-stored-state.ts)
  utils/           pure helpers two or more features use           (format-duration.ts)
  lib/             the app's own code with no third-party SDK at its edge: config/, query-keys/, player/ (the port)
  integrations/    adapters at a third-party or platform edge: devtools/, query/, video-js/, service-worker/
  styles/          app.css, the one stylesheet entry (web today has none: index.scss goes)
  __tests__/       app-level test helpers (providers, loader-api, live-page)
  assets/
  router.tsx  start.ts  routeTree.gen.ts    TanStack reads these by path, they stay at the root
```

**Web, concretely** (after 59, 62, 72, 73, 95 and the UI halves of 99, 103, 111):

```
apps/client/web/src/
  routes/                  index, search, feed.trending, channel.$channelId, watch.$videoId, login, _authed/..., $; -components/ per page
  features/                account browse channel library reactions search shell videos watch  (+ comments notifications captions)
    <feature>/             index.ts, api/, components/<name>/, hooks/, utils/, forms/, types.ts, constants.ts, __tests__/
  components/              shell/app-shell/  video/video-card, video-grid  player/taitube-player  (+ 95's kit: shelf, chip-bar, stage, queue ...)
  hooks/ utils/            use-stored-state, use-video-pages  (and what two features share)
  lib/                     config/  query-keys/  player/ (the PlayerPort)
  integrations/            devtools/  query/  video-js/  (+ service-worker/ from 68)
  styles/app.css           only if a rule survives 62; else the folder is gone
  __tests__/               providers, loader-api, live-page
```

**Studio, concretely** (after 60, 61, 93, 95 and the UI halves of 99, 103, 111): same top level, no `modules/`, no `layout/`.

```
apps/client/studio/src/
  routes/                  index, login, _authed, _authed/upload/{index,edit.$videoId}, _authed/videos/$videoId.analytics,
                           then 60's library and 61's admin/*; the upload and analytics pages are
                           routes/_authed/upload/-components/{upload-page,edit-page} and routes/_authed/videos/-components/analytics-page
  features/                account (today's auth) analytics upload videos  (+ admin notifications comments captions)
    upload/                the transfer: api/upload-video, hooks/use-upload-video, components/upload-progress/
    videos/                library, the metadata form (components/video-form/ with edit and upload variants), forms/ validators,
                           components/video-processing-status/, hooks/use-update-video
    analytics/             components/retention-chart/
    account/               the login-page and account-menu wrappers, until they lift into @vp/queries
  components/              workspace/studio-workspace/  (today's layout/studio-shell.tsx, 95 section 8: the logo, the account menu
                           as a slot, the theme menu, the link to web)  table/data-table  stats/stat-card  charts/chart-frame
                           route-fallbacks lifts into @vp/queries (slice b), else it stays here
  hooks/ utils/            absent until two studio features share one
  lib/                     config/  query-keys/ (the keys a studio mutation invalidates across features)
  integrations/            absent until studio touches an SDK at an edge (a chart library's adapter, if 60 wraps one)
  styles/app.css           studio.css's rules if any survive; they move to @vp/ui's stylesheet first
  __tests__/               providers, router, routeTree, start
```

Studio's composition: `_authed.tsx` (a route, `requireSignedIn`) renders `StudioWorkspace` from the kit around the `Outlet`,
and its account-menu slot is filled by the route with `features/account`'s `AccountMenu`; the upload page puts
`features/videos`' form beside `features/upload`'s progress and hands one the other's state through props.

**Import direction** (a layer imports only the layers below it; the arrows are the whole rule):

```
routes -> features, components, hooks, utils, lib, integrations
features -> components, hooks, utils, lib, integrations          (never another feature, never routes)
components -> hooks, utils, lib, integrations                    (never a feature or a route)
hooks, utils -> lib, integrations, utils                         (hooks may import hooks)
integrations -> lib
lib -> lib
```

- **A feature never imports another feature**, not through its `index.ts` either. When two must talk, a route composes
  them (one's output into the other's props, a slot or a callback), or the shared piece moves down: the app's
  `components/`, `hooks/`, `utils/` or `lib/`, or a `packages/client/*` package. Server state two features share goes
  through a key factory in `lib/query-keys/` (or `@vp/queries` when both apps use it), never through the other
  feature's query options.
- **Routes import a feature only through its `index.ts`.** The index exports what routes need (the page-level
  components, the loader's query options, a hook a route calls) and nothing else; `knip` already fails an export
  nobody imports, so the public face cannot grow unnoticed.
- **A feature file imports its own feature by relative path**, never `#app/features/<itself>`.
- **No cycles**, anywhere under `src/`.

**`lib/` and `integrations/` both stay, because the rule differs.** `integrations/` is where a third-party SDK or a
platform API (`@tanstack/*-devtools`, Video.js, `navigator.serviceWorker`, the browser's storage) is touched, so a
spec of it stubs the SDK, and a swap of the SDK changes only that folder; it may import `lib/` for its types, never the
reverse. `lib/` is first-party and SDK-free: the env reader, the key factories, the port the player engine
implements. One folder would force every reader to open a file to learn whether it needs a mock. Neither folder is
created empty; the test for a new file is one question: does it import a third-party package or a browser API at its
edge? Yes: `integrations/`. No: `lib/`. Things both apps need go to a package instead (next section).

**Features per app (the domains, not the pages).**

| Web | Studio |
|---|---|
| `account` (auth, then 72's settings), `browse` (home, trending, public feeds: today's `home`, `feed`, `browse`), `channel` (today's `channels`), `library` (subscriptions and their feed, then 73's history and playlists), `reactions`, `search`, `shell`, `videos` (the actions on a video: delete, later save and share), `watch` (related videos, the player host), then `comments` (103), `notifications` (99), `captions` (111) | `account`, `analytics`, `upload` (the transfer), `videos` (library, metadata form, validators, processing status), then `admin` (61), `notifications`, `comments` |

`player` stops being a feature: skin in `components/player/`, engine in `integrations/video-js/`, port in
`lib/player/`. When studio needs a preview, the three lift together into a `packages/client/` package.

**One component folder shape**, the one 95 gives a primitive, extended with the folders a larger component needs. The
same shape applies to `@vp/ui`, `@vp/components`, an app's kit and a feature's components:

```
video-card/
  video-card.tsx            the component, one per file, exports VideoCard
  video-card.variants.ts    its tv() styles, only when it has variants (static classes stay inline)
  video-card.context.ts     compound components only
  index.ts                  the folder's public face
  types.ts  constants.ts    when needed
  components/<name>/        its subcomponents, each in this same shape, recursively
  hooks/use-x.ts            hooks only this component uses
  utils/x.ts                helpers only this component uses
  __tests__/                specs, one per source file beside it: video-card.dom.test.tsx
  __stories__/              video-card.stories.tsx
```

- **Stories sit at the component folder, never in a subcomponent.** A subcomponent is shown by its parent's stories (a
  compound's parts by the root's). A subcomponent a second component needs moves up to be a sibling and gets its own.
  This moves 95's `<name>.stories.tsx` into `__stories__/` for `@vp/ui` and `@vp/components` too, so there is one
  shape; the workbench's story glob and the visual suite's "stories whose folder holds a changed file" rule read the
  story's parent folder instead.
- **Specs stay 1:1 and beside their source**, [Rule 12](../../CLAUDE.md): `hooks/use-x.ts` has
  `hooks/__tests__/use-x.test.ts`, a subcomponent has its own `__tests__/`. A route spec stays in `routes/__tests__/`.
- **Styling is Tailwind and tokens** (`tw:` classes, the role utilities of 95), a `<name>.variants.ts` when the
  component picks classes by prop. No `.scss`, no CSS module by default; the one stylesheet an app owns is
  `styles/app.css`. Nothing in the component folder needs a style file of its own beyond `variants.ts`.

**Names.** One table, written into the standard.

| Thing | Rule | Example |
|---|---|---|
| File and folder | kebab-case, lower case; route files keep TanStack's `$`, `_`, `.` and `__root` | `video-card/video-card.tsx` |
| Component | PascalCase export, file and folder name its kebab-case | `VideoCard` in `video-card.tsx` |
| Hook | file `use-<thing>.ts`, export `use<Thing>`, only in a `hooks/` folder | `use-watch-progress.ts` exports `useWatchProgress` |
| Util | verb-first camelCase export, file its kebab-case | `format-duration.ts` exports `formatDuration` |
| Constant | `constants.ts`, SCREAMING_SNAKE | `IN_VIEW_LOCAL_STORAGE_KEY` |
| Spec | `<source-stem>.test.ts` (node), `<source-stem>.dom.test.tsx` (jsdom) | `use-watch-progress.test.ts` |
| Story | `__stories__/<component>.stories.tsx` | `video-card.stories.tsx` |
| Query file | `api/<feature>-queries.ts`, keys beside | `channel-queries.ts` |
| Feature folder | singular or plural noun of the domain, kebab-case | `library`, `reactions` |
| Forbidden folder names | `pages/`, `modules/`, `shared/`, `common/`, `misc/` | |

## What to build

One stack of three slices (`feat/131-frontend-structure`, `slice/131a-...`), as few as the work allows. **Every slice
moves both apps.** The rules, the tests and the lint overrides are one set for the two apps, and a slice that moved only
web would need a second allowlist for studio and a third review of the same decisions. Inside each slice the commits go
studio first (65 files, the smaller tree, it proves the commands and the rewrites), then web, so a reviewer reads the
pattern once on the small app; the PR is one, the commits are per app.

### Slice a. Move only, 100% renames

Only `git mv` and the import and alias rewrites the moves force; no file edit beyond them, so `git diff -M --summary`
prints `rename ... (100%)` lines, and the PR says it
([git-workflow](../standards/git-workflow.md) gets its move-only paragraph here: a folder restructure ships alone).
After 110 the rewrites format themselves (oxfmt).

1. Re-survey, because 59, 60, 61, 62, 72, 73 and 95 rewrote the tree after this ticket was written.
2. Every flat component to its folder; `features/*/index.ts` added; `home`, `feed`, `browse` merged into `browse`;
   `channels` to `channel`; `auth` and `settings` to `account`; `layout/` and `route-fallbacks.tsx` into the kit;
   `player/` split into the kit, `integrations/video-js/` and `lib/player/`; `config/` to `lib/config/`; shared
   `hooks/`, `utils/` per the rules; a stray `*.stories.tsx` into `__stories__/`, in the apps and in `@vp/ui` and
   `@vp/components`; `hooks`, `utils` and `types` that serve one component into its folder.
   Studio's part of this step: `modules/Upload` dissolves into `features/upload`, `features/videos` and the route's
   `-components/`; `modules/Analytics` into the analytics route's `-components/`; `layout/studio-shell.tsx` into
   `components/workspace/studio-workspace/` (the file is whatever 60 left of it, moved as is); `features/auth` to
   `features/account`; `config/` to `lib/config/`; `studio.css` is deleted or becomes `styles/app.css`.
3. `pnpm gen:component` and its templates produce the new shape (hooks, utils, `components/`, `__stories__/`).
4. The architecture tests that can pass on the moved tree land with a ratchet where something is left for slice b
   (the cross-feature imports above, expected count equal to what remains), see Enforcement.

### Slice b. Decouple, split, lift

1. Break every cross-feature import by the table above (web's rows and studio's `Upload` and `studio-shell` edges); `index.ts` of each feature trimmed to what routes use.
2. Split the files that do too much: one component per file, a stateful block of more than a screenful to a hook, data
   out of component files (`shell-destinations.tsx` to `constants.ts` and the icons). Whole-file pass, per
   [making-changes](../agents/making-changes.md).
3. **Lift what both apps carry into the existing packages, never earlier than the second app needs it**
   ([95 section 6](95-design-system-2.md), and the tiers and layers of [packages/AGENTS.md](../../packages/AGENTS.md)):
   - `route-fallbacks` and the sign-in and account-menu wrappers: parametrised once (`homeLabel`, `titleKey`, the sibling
     app's URL) in `@vp/queries`, beside `createAppRouter` and the session hooks, when the layer rule allows the
     edge to `@vp/components`; otherwise the presentational half goes to `@vp/components` and the app passes the
     hook results in.
   - The env reader's shared half (a `parseClientEnv` that reads `import.meta.env` through a schema and a default
     for the sibling URL) into `@vp/queries` next to `api-base-url.ts`; each app keeps only its own keys.
   - `__tests__/providers.tsx` into `@vp/web-testing`.
   - `use-stored-state` and `use-video-pages` stay in web until studio imports one; then the package that fits
     (open question).
   - What `lib/`, `integrations/` and `hooks/` hold that both apps import is the sign to lift; the near-duplicate
     check below finds the rest.
4. `routes/`: every page component under `routes/-components/` or inline when short; each route file at most 80
   lines.

### Slice c. Enforce and document

The lint rules at full scope, the architecture tests with every ratchet at zero, the standard and the `AGENTS.md`
files. See Enforcement and Acceptance criteria.

## Styling and the stylesheets (every `.scss` and `.css`, and what replaces it)

| File | Verdict |
|---|---|
| `web/src/index.scss`, `styles/main.scss`, `styles/base/_base.scss`, `styles/abstract/*` (5) | 62 deletes them; nothing replaces them. `@vp/ui/styles.css` (linked once from `__root.tsx`) is the base, tokens are the colours. If anything is left, it is deleted here. |
| `web/src/styles/components/*.scss` (7: button, chip, dropdown, form-controls, modal, select, toast) | deleted: `@vp/ui`'s Button, Chip, DropdownMenu, Field, Dialog, Select, Toast replace each |
| `web/src/modules/**/*.module.scss` (15) | deleted with their page: Tailwind classes inline, a `.variants.ts` only for real variants |
| `studio/src/studio.css` (7 lines: body margin, `--bg`, `--fg`, font) | `@vp/ui/styles.css` already sets them; deleted, and the root links the package stylesheet only. If a rule survives, it becomes `styles/app.css` |
| `studio/.../upload-progress.module.css`, `video-form.module.css` | deleted with `modules/Upload`: `Progress` and `Field` from `@vp/ui` replace them |
| `packages/client/forms/src/file-field.module.css` | deleted; `@vp/ui` `Field` (62 already lists it) |
| `packages/client/ui/src/styles/*`, `workbench/.storybook/preview.css` | stay: they are the design system's own stylesheets, package-owned |

Bootstrap leftovers to confirm gone: the two `?url` stylesheet links in `__root.tsx`, `react-bootstrap` in 3 web and
3 studio sources, and the dependencies `bootstrap`, `bootstrap-icons`, `react-bootstrap`, `sass`. If 62 has not removed
one by the time this runs, slice b does.

## Deprecated APIs, surveyed

Found by walking the type checker over every client project (`tsconfig.json` and `tsconfig.spec.json` of both apps and
every `packages/client/*`): each call whose resolved signature carries `@deprecated`, and each symbol that does.
Every replacement below is read from the installed types, not guessed.

| Deprecated | Sites | Replacement, from the installed types |
|---|---|---|
| `queryClient.ensureQueryData(options)` (`@tanstack/query-core` 5.104.1: "Use `queryClient.query({ ...options, staleTime: 'static' })`") | 7: web 2 (`routes/index.tsx`, `_authed/subscriptions/index.tsx`); studio 1 (`routes/_authed/videos/$videoId.analytics.tsx`); packages 4 (`@vp/queries` `ensure-found.ts` and `session.ts`, `@vp/web-testing` `render-route.dom.test.tsx` twice) | `queryClient.query({ ...options, staleTime: 'static' })`. Same meaning: cached data of any age is returned, no refetch |
| `queryClient.ensureInfiniteQueryData(options)` | 3, all web: `routes/search.tsx`, `feed.trending.tsx`, `_authed/subscriptions/videos.tsx`; studio none | `queryClient.infiniteQuery({ ...options, staleTime: 'static' })` |
| `queryClient.fetchQuery(options)` | 9, all specs (`channel-`, `home-`, `reaction-`, `related-`, `subscription-queries.test.ts`, three in `@vp/queries`) | `queryClient.query(options)` |
| `queryClient.fetchInfiniteQuery(options)` | 5, all specs (`feed-`, `search-queries.test.ts`, `@vp/queries` `video-queries.test.ts`) | `queryClient.infiniteQuery(options)` |
| `createServerFn().inputValidator(...)` (`@tanstack/start-client-core` 1.170.34: "Use `validator` instead") | 2: `@vp/queries` `dev-only/persona-sign-in.ts`, `@vp/web-testing` `server-functions.dom.test.ts`; plus `web-testing/src/server-functions.ts`, which reads `options.inputValidator` by string and must read `validator` | `.validator(...)` |
| `FormEvent` (`@types/react`: "doesn't actually exist") | 2: web `shell-search.tsx`, the import and the one use | `SubmitEvent<HTMLFormElement>`, which the installed types export |

**Per app, the 28 sites:** web 17 (2 `ensureQueryData`, 3 `ensureInfiniteQueryData`, 6 `fetchQuery`, 4 `fetchInfiniteQuery`, 2
`FormEvent`), studio 1 (the analytics loader's `ensureQueryData`; its specs call none of the four and its sources use no
deprecated React type, checked by the same walk over `apps/client/studio`'s `tsconfig.json` and `tsconfig.spec.json`), the
client packages 10 (4 `ensureQueryData`, 3 `fetchQuery`, 1 `fetchInfiniteQuery`, 2 `inputValidator`). The ratchet counts
them the same way, per app and per package set.

Not deprecated by the types, but the legacy form React 19 replaces: `useContext(X)` in `@vp/ui`'s `appearance/provider.tsx` and
`primitives/input/input.tsx`; the rule does not flag it, the whole-file pass swaps it for `use(X)` when the file is
touched. No `forwardRef`, `defaultProps`, `React.FC` or `findDOMNode` remains in the client tiers.

Repo-wide, on the server tiers and `packages/universal`: one hit, `register` from `node:module` in
`packages/server/observability/src/tracing-sdk.ts` (`@types/node` says "Use `module.registerHooks()`"). It is not a
drop-in: the OpenTelemetry hook is an asynchronous loader hook, so the call stays, allowlisted with that reason, until the
OpenTelemetry 3 upgrade below.

**Dependencies behind their current major** (`pnpm outdated -r`, 2026-10-27): none in the client tiers. Repo-wide:
`@opentelemetry/*` 2.12.0 to 3.0.0 (five packages, server), `@types/node` 24.19.1 to 26.6.5 (Node 24 is the pinned
runtime, [34](34-node26-upgrade-deps.md) owns the move), `typescript` 6.0.3 to 7.0.2
([94](94-typescript-7-native-toolchain.md)). None is done here; the OpenTelemetry one has no ticket yet and goes to the
owner with the PR.

## Enforcement

Every rule is a tool's job. Where lint can say it, lint does (fast, in the editor); the architecture suite holds what
lint cannot resolve (relative-path escapes, folder contents, spec correspondence). A new rule needs a fixture proving it
fires ([making-changes](../agents/making-changes.md)).

| Rule | Lint (Biome today, oxlint once 110 lands) | `tests/architecture/` |
|---|---|---|
| Layer direction, feature isolation, routes use the index only | Biome `style/noRestrictedImports` with `patterns` in a per-path `overrides` block (`features/**` forbids `#app/features/**`, `#app/routes/**`; `components/**`, `hooks/**`, `utils/**` forbid `#app/features/**` and routes; `lib/**` and `integrations/**` forbid everything above; `routes/**` forbids `#app/features/*/**`). Oxlint: `no-restricted-imports` with the same `patterns` | `frontend-layers.test.ts`: resolves every import (alias and relative) with the TypeScript compiler API and fails any edge the table above does not allow; this is the one that sees `../../other-feature/x` |
| Private feature internals | `style/noRestrictedImports` pattern as above | `frontend-layers.test.ts`: a route or another layer touching `features/<f>/<anything but index>` fails |
| No cycles | Biome `suspicious/noImportCycles` (project domain), scoped to `apps/client/**/src/**`; oxlint `import/no-cycle` | none (lint owns it) |
| File and folder names | Biome `style/useFilenamingConvention` with `filenameCases: ["kebab-case"]` (route files and `__root` excepted by an override); oxlint `unicorn/filename-case` | `frontend-folder-shape.test.ts` for folder names (kebab-case, no `pages/`, `modules/`, `shared/`, `common/`, `misc/`) |
| Identifier names (component PascalCase, hook `use*`, util camelCase, constant SCREAMING_SNAKE) | Biome `style/useNamingConvention`; oxlint has no equal for the hook case | `frontend-folder-shape.test.ts`: a file under `hooks/` is `use-*.ts` and exports a `use*` function; a `components/<name>/<name>.tsx` exports `<PascalName>` |
| No `.scss`, no Bootstrap | `noRestrictedImports` on `**/*.scss`, `bootstrap`, `bootstrap/**`, `bootstrap-icons/**`, `react-bootstrap`, `sass` | `zero-matches-web-rows.ts` (the `.scss` row exists, extended to studio and widened to files); the stylesheet allowlist below |
| Stylesheets only where allowed | none | `frontend-folder-shape.test.ts`: a tracked `.css`, `.scss` or `.sass` under `apps/client/*/src/` outside `styles/app.css` fails |
| Folder shape: stories only in `__stories__/` (and only at a component folder), specs only in `__tests__/`, subcomponents only in `components/`, a hook only in `hooks/`, every feature has an `index.ts`, every component folder has an `index.ts`, no `pages/` or `modules/` | none | `frontend-folder-shape.test.ts`, over `apps/client/*/src`, `packages/client/ui/src` and `packages/client/components/src` |
| No deprecated API | Biome `suspicious/noDeprecatedImports` as an error (project domain; sees an imported deprecated symbol such as `FormEvent`, not a method call); oxlint's type-aware `typescript/no-deprecated` as an error once 110 turns type-aware linting on (confirm the rule name against the installed oxlint then) | `no-deprecated.test.ts`, in the typed architecture project over the shared `ts.Program` (`program.ts`): every call's resolved signature and every identifier's symbol must carry no `@deprecated`. Production sources repo-wide, free, the program exists; the client specs through their `tsconfig.spec.json` (a second program, measured: if it costs more than a few seconds the spec half is scoped to the client tiers and the PR says so). It is the rule until 110, because Biome cannot see a deprecated method |
| 1:1 spec correspondence | none | `test-correspondence.test.ts` (updated, next) |
| No duplicated wrappers between apps | none | `client-app-duplicates.test.ts` gains a near-duplicate row: two files of the same name in both apps that differ by fewer than 10 lines fail, with an allowlist that counts down |
| Public face stays minimal | none | `knip` (`includeEntryExports`) already fails an unused export, so an `index.ts` re-exporting what no route uses fails it |

**Scope, both apps.** Every Biome `overrides` block and every architecture test covers `apps/client/web/src` and
`apps/client/studio/src` alike. The tests take the app list from `clientApps()` (`client-apps.ts`, read from the manifests,
so a third app is covered at once), never a hard-coded path; the lint `includes` list names both
(`apps/client/*/src/features/**` and so on). The zero-matches rows (`zero-matches-web-rows.ts` already builds its scopes
with `inEachApp()` over `APPS`) take the new rows through the same helper: the Bootstrap, `.scss` and `.css` rows scope
`inEachApp('**/*.{ts,tsx,scss,css}')`, and slice a renames the file `zero-matches-client-rows.ts` (a pure move) since it
holds both apps' rows. A ratchet is a constant per app, `{ web: n, studio: n }`, and fails when either side's real count is
lower than its number, so web cannot hide studio's debt or the reverse. A fixture in each test proves the rule fires on a
studio path as well as a web one.

**Updating `test-correspondence.test.ts`.** It already resolves a source to `<dir>/__tests__/<stem>.{test,dom.test}.{ts,tsx}`
and treats `index.ts`, `*.variants` and `*.context` as parts of their component, so the shape here mostly passes as it
is: `hooks/use-x.ts` to `hooks/__tests__/use-x.test.ts`, a subcomponent to its own `__tests__/`. Four changes: `constants.ts`
joins `COMPONENT_PARTS` (it is covered by the component's spec, the way `.variants` is, resolving to the folder's own
name when the stem has no match); `productionSources()` in `repo-files.ts` excludes `/__stories__/` the way it excludes
`/__tests__/` and `/__mocks__/`, so a story helper is not asked for a spec; the fixtures in the file gain
`components/<name>/<name>.tsx`, `hooks/use-x.ts` and `constants.ts` rows; and a `routes/-components/<name>/` source is
expected to carry its spec in its own `__tests__/`, like every other component. Slice a runs it green against the moved
tree before anything else is committed.

**What overlaps.** `pnpm boundaries` (`scripts/check-boundaries.ts`) checks the packages' tiers, layers and
`package.json` edges, not the folders inside an app, so nothing here goes there and nothing is duplicated.
`knip` stays the unused-export gate and gets the public-face role above for free. `client-app-duplicates.test.ts` is
extended, not replaced. The `no-process-comments` and `file-ceiling` suites are untouched.

**Delivery of the rules** (main stays green, so each rule lands where it already passes):

- **Slice a** adds, with the moves, the rules that pass on the moved tree: the folder-shape names, `__stories__/` and
  `__tests__/` placement, the stylesheet allowlist (expected count: what is left after 62), the correspondence
  update. Each rule that something still violates lands as a ratchet whose expected count is today's count, in the same
  file as the rule (an `expected` constant the test fails on when the real count is lower, so it can only go down):
  cross-feature imports, `features` with no `index.ts`, near-duplicates between apps.
- **Biome has no baseline**, so a lint rule lands in slice a only for the folders already clean, through the
  `overrides` `includes` list, and the list widens each slice; `noImportCycles` lands in slice b once the player is
  split out, the likely source of a cycle.
- **No-deprecated** lands in slice a as a ratchet whose expected count is today's (28 in the client tiers: web 17, studio 1, packages 10; 1 repo-wide
  elsewhere, the `register` allowlist entry), and an error at 0 in slice b.
- **Slice b** takes every ratchet to 0 as it breaks the imports and swaps each deprecated call in the table above for its
  replacement (the one code edit of the stack that is not a split or a decoupling, so it is its own commit; the suites
  prove it, a spec's assertions unchanged).
- **Slice c** widens the lint overrides to every client folder, deletes the ratchet constants (a rule at zero is a plain
  assertion), and writes the docs. The stack's top slice is the first with no allowlist anywhere.

## Acceptance criteria

- [ ] Every file in `apps/client/web/src`, `apps/client/studio/src`, `packages/client/ui/src` and
      `packages/client/components/src` is in its target place, and the two target maps above hold for web and for studio: no `modules/`, `pages/` or `shared/` folder exists, every
      component is a folder of the shape above, every story is in an `__stories__/`, every spec in an `__tests__/`.
- [ ] `git diff -M --summary` of slice a prints only `rename ... (100%)` lines and import-only edits, plus the new tests and
      the template changes in their own commits.
- [ ] No feature imports another feature, anywhere; every route imports features only through `index.ts`; the cross-feature
      table above has no row left, each by the break listed.
- [ ] `frontend-layers.test.ts` and `frontend-folder-shape.test.ts` exist with fixtures proving each rule fires, and pass
      with every ratchet at 0 and its constant deleted.
- [ ] The Biome overrides (and, after 110, the oxlint equivalents) cover the rules in the Enforcement table, and
      `pnpm lint` is green; a deliberate violation of each (a feature importing a feature, a `.scss` import, a camelCase
      file, a cycle, a deprecated call) fails it, shown once in the PR.
- [ ] No deprecated API is used in the client tiers: the table under "Deprecated APIs, surveyed" is empty, `no-deprecated.test.ts`
      passes with the one allowlisted `register`, and the lint rule is an error. Each replacement is checked against the
      installed types in the PR; the loaders' behaviour (cached data returned without a refetch) is unchanged.
- [ ] `test-correspondence.test.ts` is updated as described and green; `pnpm test:architecture` green.
- [ ] No `.scss` file, no `.module.css`, no `bootstrap`, `bootstrap-icons`, `react-bootstrap` or `sass` import or
      dependency remains in the two apps and `@vp/forms`; the only stylesheet in an app is `styles/app.css`, and only if it
      has content.
- [ ] No behaviour change, in both apps: `pnpm --filter @vp/web test` and `pnpm --filter @vp/studio test` (the node and jsdom
      projects each), `pnpm test`, `pnpm test:bun`, the CI jobs `e2e-web` and `e2e-studio` (`make e2e`), and the visual shards
      (web's and studio's stories) are green with no baseline updated and no spec assertion changed (a spec moves with its source, its imports rewritten, nothing else).
      `git diff --stat -- '*.png'` on the stack is empty.
- [ ] The lazy player chunk and the bundle guard's `forbiddenDirs` still hold (`pnpm build` of both apps passes). Studio's
      build and route tree are unchanged in behaviour: `/`, `/login`, `/upload`, `/upload/edit/$videoId` and
      `/videos/$videoId/analytics` answer as before.
- [ ] Every rule in the Enforcement table is scoped to both apps, with a fixture on a studio path; each ratchet is a constant
      per app and both reach 0.
- [ ] The duplicated wrappers listed under "Duplicated between the apps" are one implementation in a package, or have an
      allowlist entry with the reason; `client-app-duplicates` is green.
- [ ] The standard is written: `docs/standards/frontend-structure.md` (both apps: the target, the import direction, the folder shape, the
      names, styling, the stories and tests placement, each app's feature list and kit, how to add a feature and a component), pointed to from root
      `CLAUDE.md`'s standards index, `apps/client/web/AGENTS.md` and `apps/client/studio/AGENTS.md` (web's section 2 and
      studio's Shell, Styles and Legacy-pages rows rewritten to the app's own tree and a pointer, not a copy), `packages/client/ui/AGENTS.md` and `packages/client/components/AGENTS.md`,
      [docs/design/architecture.md section 4](../design/architecture.md#4-how-a-component-is-shaped) (stories in
      `__stories__/`, hooks and utils folders) and [git-workflow.md](../standards/git-workflow.md) (move-only paragraph).
      Each edited `AGENTS.md` follows `writing-for-agents`: a pointer that names its trigger, the rule written once
      in the standard, no second copy to drift.
- [ ] `pnpm gen:component` produces the new shape and its spec passes.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:bun`, `pnpm test:architecture`, `pnpm boundaries`,
      `pnpm knip`, `make smoke-offline` green, with output in each PR.

## Out of scope

- Behaviour, copy, layout, tokens or a visual change of any kind; a baseline update means a slice did too much.
- Rewriting a page's logic beyond the splits named above; new features.
- Moving server packages or the tiers and layers of `packages/AGENTS.md`.
- The dependency upgrades listed under "Dependencies behind their current major" (server and tooling); only a trivial
  client one is done here, and none is pending.
- A new package for the hooks (`use-stored-state`, `use-video-pages`) before the second app imports one.
- The design library under `docs/design/` (only section 4 of `architecture.md` changes) and the design system's token and
  theme folders.
- Service worker, SEO and code-splitting tickets ([68](68-pwa-service-worker-offline-cache-background-sync.md),
  [63](63-tanstack-router-start-ssr-seo-streaming.md), [66](66-advanced-code-splitting-dynamic-chunking-lazy-loading.md)):
  they are not blockers; they land in `integrations/` and `routes/` by this standard, or move once.

## Testing plan

- Architecture: `frontend-layers.test.ts` (an `it.each` over the allowed and the forbidden edge for each layer pair,
  fixtures built from in-memory sources through the compiler API, then the same rule over the real tree),
  `frontend-folder-shape.test.ts` (an `it.each` per shape rule with a passing and a failing fixture, then the real tree),
  `test-correspondence.test.ts` (the new fixture rows), `client-app-duplicates.test.ts` (the near-duplicate rows).
- Deprecations: `no-deprecated.test.ts` with a fixture that calls a `@deprecated` method and one that does not; the loader
  swaps are covered by the route specs (`renderRoute`) and the e2e suites, which already load every one of these routes.
- Lint: one throwaway file per rule, fails once, deleted; recorded in the PR, not committed.
- Studio: its `routes/__tests__` (`renderRoute` specs for `/upload`, `/upload/edit/$videoId`, the analytics route and `_authed`),
  the specs of every moved component and hook, `e2e/` (`appearance`, `upload`, `user-events`, `security/`) as `e2e-studio`, and
  the studio stories in the visual shards once 60 and 95 add them; web's equivalents the same way.
- Regression: the whole existing unit, jsdom, bun, e2e (web and studio) and visual suites unchanged and green; a spec's only edit is an
  import path. `pnpm build` for both apps, and the bundle guard.
- `scripts/__tests__/gen-component.test.ts` for the template change.

## Open questions

- **Order after 110: decided.** 131 follows 110. The reformat touches nearly every client file, so moving after it makes
  the move PR's rewrites format-clean and no conflict is resolved twice. 110 depends only on 95, so it can run while 59
  to 73 are in flight.
- **Blocked by 111 whole, owner's call.** 111's backend and worker halves can delay its UI half by weeks. If that
  happens, the owner either splits the UI half of 111 out or drops that blocker and 111's UI rebases onto the new tree;
  recommended: keep it, and only split if 111 is still blocked once 59, 60, 61, 62 and 72 are done.
- **Later front-end tickets** (101, 102, 105, 106, 114 to 122, 129 and the rest) are not blocked: they scaffold with
  `pnpm gen:component` and follow the standard once it lands. A merge freeze on front-end PRs for the day slice a lands is
  cheaper than rebasing them; the stack's lead asks the owner for it.
- **The kit versus a feature's components.** 95 puts about 25 named components in the kit (`ChannelHeader`, `Queue`,
  `CommentThread`, `Stage`...) even where one feature draws them, because the design library catalogues them per app.
  This ticket keeps them there (the kit is the app's presentational layer, features the smart one), and applies "one
  feature only" to everything else: wrappers, hooks, utils, api. The alternative, moving one-feature components into
  their feature, would split the kit from the design library's `docs/design/apps/` pages.
- **`__stories__/` against 95's `<name>.stories.tsx`.** This ticket changes 95's shape (the owner's call) for one reason:
  a folder reads as source, spec, story at a glance. The cost is two edits in the workbench (the glob, the visual
  suite's changed-folder rule), both in slice a.
- **Styling files.** The owner asked for a style file per component; 95's rule (`tv()` only for a real variant, static
  classes inline) makes `<name>.variants.ts` that file, present only when it has variants. A CSS module would need a
  documented case Tailwind cannot express; none exists today, so none is allowed.
- **Where `use-stored-state` and `use-video-pages` go** when studio needs them: `@vp/queries` is about data and session,
  `@vp/ui` about primitives; a small `@vp/hooks` package (client, below `@vp/components`) may be right. Decide at that
  time, not now.
- **Route layout files.** `routes/-components/` works through TanStack's default `routeFileIgnorePrefix` (`-`), which
  `packages/server/vite-preset/src/client-app-config.ts` does not override (it sets only `routeFileIgnorePattern: '__tests__'`);
  slice a checks that with a build before moving anything. A `<route>.page.tsx` beside the route file is not used: the
  router would treat it as a route.

## Definition of Done

- [ ] All acceptance criteria proved with command output in the PRs.
- [ ] `docs/standards/frontend-structure.md` written and linked as above; `docs/design/architecture.md` section 4 and
      `git-workflow.md` updated.
- [ ] The architecture rows added to [ARCHITECTURE.md section 6](../../ARCHITECTURE.md#6-verification--enforcement).
- [ ] Ticket status set to `done` and `python3 docs/tickets/gen-index.py` re-run.
