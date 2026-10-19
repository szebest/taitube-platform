# 95: Design system 2 - themes and swappable token sets, shared option types, primitives, components and a workbench

| Field | Value |
|---|---|
| Phase | 5 — Developer experience & growth |
| Size | XL (four stacks of slices a to bb, see *Delivery*) |
| Blocked by | 54 - Frontend testing infrastructure · 55 - Design system foundation · 89 - TanStack Start foundation · 91 - Web import aliases · 93 - Creator Studio app |
| Blocks | 59, 60, 61, 62, 68, 69, 70, 72, 73, 74, 86, 96, 99, 102 |
| Spec | [PRD §1 Summary](../PRD.md#1-summary) · [SDD ADR-21 Frontend framework](../SDD.md#adr-21--modern-frontend-framework-react-19--tanstack-start-ssr--tanstack-router-no-nextjs) · [SDD ADR-23 Package runtime tiers](../SDD.md#adr-23--package-runtime-tiers-the-directory-is-the-tier) |

**Status:** in-progress

> **Priority: next.** Start as soon as the 57 and 58 slices already in review merge, before any other frontend
> ticket, so everything after it is built on this system rather than migrated onto it later. Every frontend
> ticket that renders UI and has not started is blocked by 95, and the open stacks of 57 and 58 pause after
> their current slices (see the coordination note). The ticket stays in-progress until the fourth stack merges.

> **Read first.** [docs/design/README.md](../design/README.md) is the look (principles, Sand and Nocturne, the
> roles, layout, the anatomy of every surface, the polish bar). [docs/design/architecture.md](../design/architecture.md)
> is the build (the layers, token sets, the shared option types, compound components, smart wrappers). The
> values are [docs/design/tokens.json](../design/tokens.json); the specs are under
> [primitives/](../design/primitives/README.md), [components/](../design/components/README.md),
> [apps/web/](../design/apps/web/README.md) and [apps/studio/](../design/apps/studio/README.md); the screens are in
> [docs/design/index.html](../design/index.html). Where this ticket and the architecture disagree, fix one of them
> in the same PR.

> **Why.** 55 put Tailwind 4 and Radix into `@vp/ui`, but the apps still carry three systems at once: the
> `--vp-*` variables in `design-system.css`, the legacy `--grayscale-*` SCSS maps keyed off the same
> `data-theme`, and Bootstrap 5 with 26 `.module.scss` files (1,638 lines of SCSS). No live web page renders a
> `@vp/ui` primitive yet. A theme is a block of hand-written CSS, there is one theme in two modes, every
> dimension of the look is welded to it, and every component spells its own string unions. The page tickets
> queued behind this one would each build on that.

> **Coordination with the open stacks.** 57 (`feat/57-production-video-player`) and 58
> (`feat/58-modern-browse-layout`) are in progress. Their merged slices stay. 57e onward restarts once
> slices ab, y, an, f and k here are merged, 58g onward once ag, aj, ak, am and ar are. 58c's shell moves into web's
> app kit in a move-only slice ai, then the split slice aj (the kit's `AppShell` presentational, the smart wrapper in
> `features/shell`); 58 then mounts it instead of owning it.

## What to build

A design system where a theme is an identity plus a default for each of nine swappable token sets, every value
has one source, every prop union comes from a shared vocabulary, and every component is compound, built, seen
and tested in one workbench. Adding a theme, a token set, a primitive or a component is a small, checked change.

### 1. The engine: `@vp/design-tokens`

New package `packages/universal/design-tokens`, tier `universal`, layer T2 (`zod`, and the appearance vocabulary of
`@vp/domain/settings`, which [97](97-account-preferences-api.md) built: `APPEARANCE_SETTINGS.mode.options` and
`.contrast.options`, `PREFERENCE_ID_PATTERN`, `TOKEN_GROUP_PATTERN` and `MAX_APPEARANCE_OVERRIDES`). It holds no concrete value ([architecture section 1](../design/architecture.md#1-five-layers)):

- **Schemas per token group** (`typography`, `fontSize`, `spacing`, `sizing`, `radius`, `border`, `shadow`,
  `ambient`, `motion`) and for a theme's colour roles (`ROLES`, the one list of role names) and dataviz.
  `TOKEN_GROUPS` is the one typed list of the nine; every name matches `TOKEN_GROUP_PATTERN` and the nine fit
  under `MAX_APPEARANCE_OVERRIDES`. Decided (95b): `ref` (the tier 1 ramps) and `scale` (the raw 4 px scale, the
  z layers, breakpoints and layout measures, with `ZLayer` and `Breakpoint`) get their own `RefSchema` and
  `ScaleSchema` beside the groups, not a tenth group and not inside a theme: nothing in them is switchable or
  per theme, and the `signal` ramp is shared by both themes.
- **`defineTokenSet(group, id, values)`**, **`defineTheme({ id, name, color, dataviz, defaults })`** (every group
  required in `defaults`) and **`defineAppearance({ themes, defaultTheme, offer })`** (every theme's defaults
  offered). Decided (95b): all three are typed identity helpers, so a missing key, group or offer is a compile
  error; `parseTheme` and `parseTokenSet` are the one runtime check and return a `Result` with
  `VALIDATION_FAILED` naming the field (f's spec and l's `registerTheme` use them). Theme and set ids match
  `PREFERENCE_ID_PATTERN`.
- **The shared option unions tied to tokens**, each a `const` array and its type: `SizeOption`, `ControlSize`,
  `IconSize`, `RadiusOption`, `ElevationOption`, `TypeStyleOption`, `SpaceStep`, `ColorRole`, `ToneOption`,
  `ModeOption` and `ContrastOption` (built on `@vp/domain`'s vocabulary), `TokenGroup` ([architecture section 3](../design/architecture.md#3-shared-option-unions)).
  Decided (95b): each array lives in the schema file it keys and the schema is built from it, so a union cannot
  drift from its tokens (`SIZE_OPTIONS`, `CONTROL_SIZES`, `ICON_SIZES` in sizing; `ELEVATION_OPTIONS` (1 to 3)
  in shadow, whose keys are mode family by elevation; `SPACE_STEPS` are the spacing roles, not the raw scale);
  `ToneOption` is `neutral`, `accent`, `success`, `warning`, `danger`, `info`, `live`, next to `ROLES`.
- **Pure generators**: the CSS for a theme (roles under `[data-theme][data-mode]`, OLED composed over dark), the
  CSS for a token set (under `[data-<kebab-group>="<id>"]`, mode-family aware for `shadow` and `ambient`), the
  Tailwind `@theme inline` block mapping roles, radii, type styles, spacing roles, sizes, borders, shadows and
  motion to utilities (the default palette wiped, as 55 does), and `deriveAccent(hex, family)` for a viewer's
  accent override, stepped in OKLCH until each pair meets its floor. Decided (95c): `family` is `'dark' | 'light'`
  (the caller maps OLED to dark). It returns a `Result`: `VALIDATION_FAILED` for a malformed hex, else `accent`
  (also the focus ring) at 3:1 and `accentInk` at 4.5:1 against `ACCENT_GROUNDS[family]` (the lightest dark and
  darkest light ground a theme may use, so one result holds on every theme of the family), `accentSoft` (`accent`
  at alpha `29`, with `accentInk` at 4.5:1 on it over the ground), `accentHover`, and `onAccent`, black or white,
  at 4.5:1 on `accent` and `accentHover`. `groundsInsideAccentBand` says whether a theme's grounds sit inside them.
- **The contrast gate**: a spec walks every theme, mode and required pair (text 4.5:1; control outlines, focus
  ring and icons 3:1; translucent roles composited over the ground; `checkRoleContrast` next to `ROLES` holds the
  pairs) and `deriveAccent` over a hostile table
  (pure yellow, near-white, near-black, the ground itself).
- `pnpm gen:tokens` writes `docs/design/tokens.json` from the engine and the registered sets and themes;
  `--check` in CI fails on drift. A regenerated `tokens.json` and generated CSS are not an edit by hand.
- Keys are camelCase in TypeScript and `tokens.json` (`fontSize`); module paths and attributes are kebab-case
  (`@vp/ui/tokens/font-size/<id>`, `data-font-size`), and each group's schema exports its kebab name.
- `knip.json` turns `includeEntryExports` off for `@vp/design-tokens`, `@vp/ui` and `@vp/components`: their
  exports are entry points by design.
- SDD gains **ADR-28: themes and token sets are data** and `packages/AGENTS.md` the package's row.

### 2. Token sets and themes in `@vp/ui`

- **Every token set implementation is its own module**, `packages/client/ui/src/tokens/<kebab-group>/<id>/`,
  exported as `@vp/ui/tokens/<kebab-group>/<id>` (`"./tokens/*"` in `exports`): three typography sets, four font
  sizes, three spacing, three sizing, three radius, three border, three shadow, three ambient, three motion,
  with the values in `tokens.json`. A typography set imports its fonts (`@fontsource-variable/*`, bundled,
  Rule 6), so a face downloads only when its set is active.
- **A theme is a folder**, `src/themes/<name>/`, exported as `@vp/ui/themes/<name>`: its colour roles per mode,
  its dataviz palettes and its `defaults`, one import per group
  ([architecture section 2](../design/architecture.md#2-themes-and-token-sets)). Sand defaults to figtree, default
  font size and spacing, medium sizing, round, hairline, soft shadow, cinematic ambient, standard motion;
  Nocturne to geist, default, default, medium, sharp, regular, flat, subtle, standard.
- **One registry**, `src/appearance/registry.ts`, the only file that names themes and sets: `themes`,
  `defaultTheme`, and `offer` (the implementations a viewer may switch to, per group). Changing a theme's
  default for one group is one line in that theme; changing the product's default theme is one line here;
  offering a new set is one import and one entry here. Only offered sets ship.
- `pnpm gen:theme <name> --from sand` and `pnpm gen:token-set <group> <id> --from <id>` scaffold a theme or a set
  with its workbench story, ready to tune and register.

### 3. The appearance engine in `@vp/ui`

- **The preference** (`AppearancePreference`, `schema: 2`: theme, mode, accent, contrast, and `overrides` per
  token group), its Zod schema built from the registry, in the `vp.appearance` cookie (55's shared `Domain`
  kept, so web and studio share it). An existing `vp.theme` cookie is read once as Sand in that mode and
  rewritten. Account sync is [97](97-account-preferences-api.md)'s endpoint, which [72](72-frontend-settings-customization-system.md)
  wires.
- **Resolution**: per group, the viewer's override if offered, else the theme's default; an app may pass its own
  defaults (the studio starts on compact spacing and small sizing); `prefers-reduced-motion` forces
  `motion: reduced`.
- **Server first**: `ThemedDocument` renders `data-theme`, `data-mode`, `data-contrast` and one `data-<kebab-group>`
  per token group (`data-font-size`) on `<html>`, plus the accent override as derived variables. For `system` the pre-paint script
  resolves the mode before paint (with the request nonce). No flash, no hydration warning.
- **Runtime switch with no reload**: `useAppearance()` reads the resolved state and sets any axis or override;
  `resetOverrides(group?)` returns a group or all of them to the theme's defaults. A change writes the cookie and
  the attributes and cross-fades through the View Transitions API (the motion set's `cinematic` duration).
- **Runtime themes**: `registerTheme(theme)` parses a `Theme` that arrives as data, runs the contrast gate and
  injects its CSS, for later channel-branded or user-built themes; check the mechanism against the CSP from
  `@vp/security-headers` (`style-src`) and document it.
- **Copy**: `UiCopyProvider` and `useUiCopy()` for every built-in string of a primitive or component; each app
  fills it once from `@vp/messages`. No component takes a `labels` prop.
- **Icons**: an `Icon` primitive over `lucide-react`, sized by `IconSize` from the sizing set.

### 4. Workbench: `@vp/workbench`

- New private package `packages/client/workbench`, layer T4, running Storybook (current major, `@storybook/react-vite`)
  over the stories beside their components in `@vp/ui`, `@vp/components` and both apps' kits, through the same
  `@vp/vite-preset` aliases. It globs the apps' stories by path and imports no app package.
- **Toolbars read the registry**: theme, mode, accent, contrast, direction, and one per token group listing the
  offered sets with "theme default" first, driving the same attributes `ThemedDocument` sets.
- The a11y addon on every story; stories run as Vitest tests through the Storybook Vitest addon.
- **Visual regression**: Playwright walks the built Storybook's `index.json` and screenshots each story in
  every registered theme × dark, light, OLED, plus a token-set matrix for stories tagged `tokens` (each offered
  set of `spacing`, `sizing`, `radius`, `fontSize` once) and RTL and more contrast for stories tagged `text`.
  It runs in the pinned Playwright container with baselines in Git LFS and `pnpm test:visual --update`; shard it.
  A PR runs its changed stories at Sand dark and Nocturne light, `main` the full matrix (Rule 11).
- The dev-only `/design-system` route and `features/design-system` in web go.

### 5. Primitives v2 in `@vp/ui`

- **One folder per primitive** (component, `.variants.ts`, `types.ts`, story, jsdom spec, `index.ts`;
  [architecture section 4](../design/architecture.md#4-how-a-component-is-shaped)), compound for anything with
  more than one region (`X.Root` and parts sharing context through `createCompoundContext`), single components
  over native props for single elements.
- **Shared UI types** in `src/types/`: `FillOption`, `ShapeOption`, `Orientation`, `Align`, `Side`. A props
  interface never spells an inline string union: it uses the shared unions, narrowed with `Extract` and
  `Exclude` in the component's `types.ts`; `tv()` maps are typed against them.
- **Rebuild the 24 that exist** (`ContextMenu` from 57c and `IconButton` from `button.tsx` among them; `Sheet` folds
  into `Dialog`) and **add** `Icon`, `Kbd`, `Popover`, `HoverCard`, `Command`,
  `Slider`, `ToggleGroup`, `SegmentedControl`, `ScrollArea`, `Chip`, `Drawer`, `AspectRatio`, `VisuallyHidden`,
  `Callout`, `Table` (styling and parts only; sorting and selection state stay with the caller), `SortableList`
  (the one keyboard and pointer reorder, behind web's queue and playlists and studio's pins and category order). The full list
  and every API: [docs/design/primitives/](../design/primitives/README.md).
- Logical properties only, so RTL (86) needs no component change.
- **Extension points** exported on purpose: `className`, `asChild`, the context hook of every compound
  component, and the `tv()` styles for `extend` ([architecture section 4](../design/architecture.md#open-for-extension-closed-for-modification)).
- `pnpm gen:component <name> --kind primitive|shared|web|studio [--compound]` scaffolds the folder in the right
  place, including the context file for a compound one.

### 6. Shared components: `@vp/components`

New package `packages/client/components`, tier `client`, layer T3 (above `@vp/ui`; no edge to `@vp/forms`, its
T3 sibling). It holds **only what both apps render today**: `PageHeader`, `VideoThumbnail` (the frame with
duration, progress and badges that web's cards and studio's library rows both draw), `EmptyState`,
`ErrorState`, `SectionError`, their skeletons, and the presentational parts of 56's login card and account menu
(`LoginPage` and `AccountMenu` live in `@vp/queries` today and both apps use them). Presentational, compound,
same folder shape. Nothing one app alone uses goes here
([architecture section 1](../design/architecture.md#1-five-layers)); specs:
[docs/design/components/](../design/components/README.md).

### 7. Web's app kit

`apps/client/web/src/components/<area>/<name>/`, presentational and compound, built from `@vp/components` and
`@vp/ui`: `AppShell` (58c's shell moved here in a move-only slice, then split), `NowPlayingBar`, `CommandPalette`, `VideoCard` (on
`VideoThumbnail`, with the `grid`, `shelf`, `row`, `poster` and `spotlight` variants, and `VideoCard.Expanded` with its
motion: 95 owns both, 58 wires the data), `Shelf`, `ChipBar`,
`PickOfTheDay`, `Stage`, `EngagementBar`, `LinerNotes`, `Queue`, `CommentItem`, `CommentThread`, `OfflineState`, `ChannelHeader`,
`StartHereShelf`, `NotificationCentre`, `LiveChat`, `ShortsPlayerFrame`. Specs:
[docs/design/apps/web/](../design/apps/web/README.md). Plus **one reference smart wrapper**,
`features/browse/components/feed-video-card.tsx`, written exactly as
[architecture section 5](../design/architecture.md#5-smart-wrappers-in-the-apps) shows, so the page tickets copy a
working shape.

It also restyles the surfaces [56](56-frontend-universal-auth-session-security.md) shipped in `@vp/queries`
(`LoginPage`, `AccountMenu`, used by both apps). Their presentational parts move into `@vp/components`; the session
hooks (`useAccount`, the `signOut` and `settleSession` wiring, `LoginSearchSchema` with `reason=expired`) stay in
`@vp/queries`; each app keeps a thin wrapper in `features/auth/components/`:

- `/login` is rebuilt from `@vp/ui` primitives (section 5) on the guide's layout
  ([docs/design/README.md section 7](../design/README.md#7-layout-and-the-shell)); a failed sign-in shows its
  presented message in a `Callout` (an error slot on `LoginPage`), and a session that expired (`reason=expired`,
  and the 401 path) lands here with an `EmptyState` line saying so above the form. Both ship in slice al.
- A member-only section on a public page (the You hub, the followed channels in the rail) shows a guest the
  `EmptyState` (section 6) with one editorial line and one action, Sign in, linking to
  `/login?redirect=<current>` (`SignedOutSection`, shipped in al); a whole member-only route still redirects through
  `_authed`.
- The account menu moves onto `DropdownMenu` and `Avatar` from `@vp/ui`,
  mounted in the header slot of `AppShell` (58 mounts the shell), with sign out still through `signOut`.

### 8. Studio's app kit

`apps/client/studio/src/components/<area>/<name>/`: `StudioWorkspace`, `DataTable` (studio behaviour over the
`Table` primitive and TanStack Table), `StatCard`, the chart components over the `dataviz` palettes. Specs:
[docs/design/apps/studio/](../design/apps/studio/README.md). One reference smart wrapper,
`features/content/components/library-video-row.tsx`.

### 9. Motion

Motion utilities from the motion set, one `useSlidingIndicator` helper behind the `SegmentedControl` thumb,
the `Tabs` underline and the single-select `ChipGroup` pill, overlay and toast entrances, TanStack Router view transitions with the shared element from
`VideoThumbnail` to `Stage` (`view-transition-name` from the video id), hover lift and expand-on-hover after
500 ms on pointer devices (`VideoCard.Expanded`; 58 wires its data, and `ax` edits only 57's `watch-player.tsx` frame), menu and chip enters, the theme cross-fade. Under `motion: reduced` (chosen, or forced by
`prefers-reduced-motion`) nothing moves: transitions are opacity and colour only, overlays fade, skeletons and the live
dot are static, view transitions are off and autoplay previews start paused
([foundations/motion.md](../design/foundations/motion.md#reduced-motion-precisely)); keyboard-opened surfaces never
animate their open. A workbench interaction story per indicator proves the slide, and the visual suite runs
the `reduced` set.

### 10. Future surfaces, as shells

`/shorts`, `/live` and the notification centre in web, each rendering its designed empty state until its
feature ticket wires data. A rail link to one appears only with its route.

### 11. Enforcement and docs

Rows in `tests/architecture/`, each with a fixture proving it fires, and a line in ARCHITECTURE.md section 6:

- **Shared unions**: no inline string-literal union in a props type of `@vp/ui`, `@vp/components` or an app's
  `src/components/` outside a `types.ts` (TypeScript compiler API).
- **No app-only code in `@vp/components`**: every export is imported by both apps (a component one app alone
  imports moves to that app's kit).
- **Token sets stay data**: nothing outside `@vp/ui/src/tokens/` and `src/themes/` declares a token value, and
  nothing outside the registry imports a theme or set to offer it.
- **No raw colour, Radix and `@dnd-kit/*` only in `@vp/ui`, logical properties only, no new stylesheets** (an allowlist of
  today's legacy files that 62 empties), **folder shape** for every primitive and component, **drift** of
  `tokens.json` and the generated CSS, and **the design library stays in the docs** (nothing outside `docs/`
  imports `docs/design/lib/` or uses a `tt-` class).

Docs: `docs/standards/design-system.md` (adding a token set, a theme, a primitive, a component, a wrapper;
linking the architecture and the polish bar rather than copying them); `packages/client/ui/AGENTS.md`
rewritten; new `AGENTS.md` for `@vp/design-tokens`, `@vp/components` and `@vp/workbench`; both apps'
`AGENTS.md` updated (styling row, the app kit, wrappers); the `ui-reference-capture` skill in `.agents/skills/`
(reference measurements with `chrome-devtools-axi`, recorded as numbers, no copied assets).

## Folder layout

```
packages/universal/design-tokens/        @vp/design-tokens   universal T2
  src/schema/        roles.ts theme.ts token-group.ts ref.ts scale.ts values.ts and one file per group, each with its option arrays
  src/color/         rgb.ts oklch.ts
  src/generate/      theme-css.ts token-set-css.ts tailwind-theme.ts dtcg.ts
  src/               accent.ts contrast.ts define.ts parse.ts index.ts

packages/client/ui/                       @vp/ui              client T2
  src/tokens/<kebab-group>/<id>/index.ts  @vp/ui/tokens/<kebab-group>/<id>
  src/themes/<name>/  color.ts dataviz.ts index.ts (defineTheme with defaults)   @vp/ui/themes/<name>
  src/appearance/     registry.ts preference.ts resolve.ts provider.tsx themed-document.tsx pre-paint.ts register-theme.ts
  src/primitives/<name>/  <name>.tsx <name>.variants.ts types.ts <name>.stories.tsx __tests__/ index.ts
  src/types/          fill.ts shape.ts orientation.ts align.ts side.ts index.ts
  src/copy/           ui-copy.ts provider.tsx
  src/lib/            cn.ts tv.ts create-compound-context.ts variant-names.ts
  src/styles/         index.css base.css

packages/client/components/               @vp/components      client T3
  src/<area>/<name>/  page-header, video-thumbnail, login-card, account-menu, states/*

packages/client/workbench/                @vp/workbench       client T4, above @vp/components
  .storybook/  visual/

apps/client/web/src/components/<area>/<name>/       web's kit: shell, video, watch, channel, discovery, live, shorts
apps/client/web/src/features/<feature>/components/   smart wrappers
apps/client/studio/src/components/<area>/<name>/    studio's kit: workspace, table, stats, charts
apps/client/studio/src/features/<feature>/components/
```

## Delivery

Four `gh stack`s of slices, lettered across them. Each stack has its own feature branch and draft feature PR, merges
to `main` when its slices are in, and the next one cuts from `main` after it. Each slice is its own PR and green on
its own. The ticket stays `in-progress` until the fourth stack merges, and its top slice sets `done`.

| Stack | Branch | Slices |
|---|---|---|
| 1, foundations | `feat/95-design-system-2-foundations` | a to q |
| 2, primitives | `feat/95-design-system-2-primitives` | r to af |
| 3, components and kits | `feat/95-design-system-2-components` | ag to av |
| 4, motion, future shells, enforcement, docs | `feat/95-design-system-2-finish` | aw to bb |

The eleven parts of *What to build*, as slices:

1. **Engine** (section 1): a to d. `@vp/design-tokens`: schemas, `define*`, option unions, generators, the contrast
   gate, ADR-28.
2. **Token sets and themes** (section 2): e to h. Wildcard exports in the vite preset, every set under
   `@vp/ui/tokens/`, Sand and Nocturne, the registry, `pnpm gen:tokens`.
3. **Appearance engine** (section 3): i to m. The preference and cookie migration, resolution, `ThemedDocument`, the
   pre-paint script, `useAppearance`, the stylesheet cutover, `registerTheme`, `UiCopyProvider`, `Icon`; both apps
   switched over with no visible change beyond the new theme.
4. **Workbench** (section 4): n to q. `@vp/workbench`, `/design-system` removed, the visual suite in CI,
   `pnpm gen:theme` and `pnpm gen:token-set`.
5. **Primitives, rebuilt** (section 5): r to y. Shared UI types, `createCompoundContext`, the folder layout, the 24
   rebuilt, the generator.
6. **New primitives** (section 5): z to af. The additions, `Table` among them.
7. **Shared components and web's kit** (sections 6 and 7): ag to as. `@vp/components` and the shell (ag to am: the
   shell moved in by ai, move-only, and split by aj; 56's login page, signed-out section and account menu restyled
   from `@vp/ui` by al), then the rest of web's kit and the reference `FeedVideoCard` (an to as).
8. **Studio's kit** (section 8): at to av. `StudioWorkspace`, `DataTable`, `StatCard`, charts; the reference
   `LibraryVideoRow`.
9. **Motion** (section 9): aw and ax.
10. **Future shells** (section 10): ay.
11. **Enforcement and docs** (section 11): az to bb.

## Acceptance criteria

- [ ] `@vp/design-tokens` exists at T2 in the `universal` tier; every set and both themes parse against their
      schemas; a set missing a key or a theme missing a role or a default fails the build.
- [ ] Changing Sand's `shadow` default from `shadowSoft` to `shadowDeep` is a one-line diff that changes Sand
      in both apps, the server render and the workbench (a regenerated `tokens.json` and generated CSS do not count
      as another edit); changing `defaultTheme` is likewise one line.
- [ ] A set scaffolded with `pnpm gen:token-set shadow dramatic --from deep` and added to `offer` appears in the
      preference schema, `useAppearance()`, the workbench toolbar and the visual matrix with no other edit (a regenerated
      `tokens.json` and generated CSS are not one); a set
      not in `offer` is absent from both apps' bundles and CSS.
- [ ] Overriding `spacing` to `airy` at runtime applies without a reload, survives a reload (cookie), and
      survives a theme switch, while groups without an override follow the new theme's defaults.
- [ ] The studio starts on compact spacing and small sizing with no override set; web on the theme's defaults.
- [ ] The contrast spec covers every theme, mode and required pair, and `deriveAccent` over its hostile table.
- [ ] `pnpm gen:tokens --check` passes in CI and fails when `docs/design/tokens.json` or a generated CSS file is
      edited by hand.
- [ ] The server render of any route carries `data-theme`, `data-mode`, `data-contrast` and every
      `data-<kebab-group>` from the cookie; a `system` render resolves before first paint; no hydration warning.
- [ ] A `vp.theme=light` cookie from before this ticket renders Sand light and is rewritten as `vp.appearance`.
- [ ] `registerTheme` of a valid theme renders it; of one failing contrast returns the failing pairs and
      renders nothing; the injected CSS passes the app's CSP.
- [ ] No props type in `@vp/ui`, `@vp/components` or the apps' kits spells an inline string union; the
      shared-unions row fails its fixture.
- [ ] Every export of `@vp/components` is imported by both apps (true once slices at, au and ay are in); the row
      fails a fixture with a web-only export.
- [ ] `pnpm workbench` shows every primitive, shared component and app-kit component with all toolbars; the
      visual suite runs in CI and fails on a one-token change to a role or set a story uses.
- [ ] Every primitive and component has a story per variant and state, a jsdom spec with the axe check, and
      passes the folder-shape row.
- [ ] `pnpm gen:component chip-bar --kind web --compound` produces a folder that typechecks, lints and passes its
      own spec unedited.
- [ ] `FeedVideoCard` and `LibraryVideoRow` take only the entity and placement props, read the rest from hooks,
      and have route-level specs with MSW.
- [ ] A card's thumbnail morphs into the watch page's stage on navigation; with reduced motion only opacity
      changes.
- [ ] 56's surfaces meet the polish bar ([docs/design/README.md section 9](../design/README.md#9-the-polish-bar)).
- [ ] `/login`, the account menu and the signed-out `EmptyState` are composed from `@vp/ui`,
      `@vp/components` and web's app kit only: `src/features/auth/` holds no stylesheet and no class outside
      layout utilities.
- [ ] A failed sign-in moves focus to the `Callout` and keeps the form's input; the account menu opens with
      Enter from the header avatar, arrows move through it and Escape returns focus to the avatar (jsdom
      specs).
- [ ] The signed-in header's avatar is in the server render at its final size, so hydration shifts nothing
      (the header contributes 0 to CLS in the Playwright run).
- [ ] `/shorts`, `/live` and the notification centre render their empty states in every theme and mode.
- [ ] No font, icon or stylesheet loads from another host (`make smoke-offline`, `local-first.test.ts`).
- [ ] `pnpm boundaries`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:bun`,
      `pnpm test:architecture` green, with output in each PR.

## Out of scope

- Removing Bootstrap, `react-bootstrap`, `bootstrap-icons`, Sass, the SCSS and the `tw:` prefix:
  [62](62-frontend-performance-virtualization-ssr-bundle-hardening.md).
- Rebuilding the pages and their smart wrappers beyond the two references: each page ticket (58 browse, 59
  watch, 60 studio, 61 admin, 70 error pages, 73 library, 74 search).
- The settings pages: [72](72-frontend-settings-customization-system.md), on `useAppearance`.
- Storing preferences in the account: [97](97-account-preferences-api.md).
- Curation data for Pick of the day: a follow-up ticket; 58 fills `PickOfTheDay` with a fallback.
- Persistent playback behind `NowPlayingBar`: [73](73-frontend-youtube-playlists-library-player-queue.md).
- Channel-branded and user-built themes: the engine supports them; shipping one is a later ticket.

## Notes for the implementer

- **Read the guide and the architecture before the first line**, then open `docs/design/index.html` (serve
  `docs/design` over HTTP) and use its switcher's Token sets panel: it is the runtime behaviour this ticket
  builds, in plain JS.
- **Tailwind's `tw:` prefix stays** while Bootstrap does; keep generated class names prefix-agnostic so 62's
  codemod is a mechanical strip. The default palette stays wiped.
- **Radix through the one `radix-ui` package**; `Command` on `cmdk` if Radix has no combobox (bundled, so
  local-first holds); current majors (`npm view <pkg> version`).
- **TanStack Router's view transitions**: read the router skill in `node_modules/@tanstack/*/skills/` first.
- **Visual baselines** only inside the pinned container (`make visual` locally), stored in Git LFS.
- **Moving 58c's shell**: coordinate with whoever holds the 58 stack; move-only commit first.

## Migration from 55's `@vp/ui`

Every call site moves in the slice that renames it, so no alias survives.

| Today | After 95 |
|---|---|
| roles `surface-elevated`, `popover` | `surface` (cards), `raised` (menus, popovers, toasts) |
| `overlay` | `scrim` |
| `danger-solid` / `on-danger` | `danger` with white text; `danger-ink` for text |
| `success`, `warning` fills, `border-l-success` | `tint` ground with `success-ink` / `warning-ink` text and the status icon |
| `ring` | `focus-ring` |
| radii, fonts and shadows on the theme | the `radius`, `typography` and `shadow` token sets |
| flat exports (`DialogContent`, `TabsTrigger`, `CardContent`, `SelectItem`, `TooltipRoot`) | compound parts (`Dialog.Content`, `Tabs.Tab`, `Card.Body`, `Select.Item`, `Tooltip.Root`) |
| `Button variant="destructive"` | `variant="solid" tone="danger"` |
| `Badge variant="success"`, `Toast variant=…`, menu item `variant="danger"` | `tone="success"`, `tone=…`, `tone="danger"` |
| `Field` `label` / `description` / `error` props, `orientation` | `Field.Label` / `.Hint` / `.Error` parts, `orientation` from the shared `Orientation` |
| `Avatar` `name` + `src`, sizes 24/36/48/80 | `Avatar.Image` / `.Fallback`, `size: SizeOption` from the sizing set |
| `closeLabel` on `DialogContent` and `ToastProvider`, `Spinner` `label` | `UiCopyProvider`; the spinner's label is a child |
| `Sheet` | `Dialog.Content` with a `side` from the shared `Side`; the bottom form is `Drawer`; confirmations are `AlertDialog` |
| `BrandLogo` (red outlined paths) | `Logo` with `variant="lockup" \| "mark" \| "wordmark"`, one ink |

## Testing plan

- `@vp/design-tokens`: node specs for every schema, `define*`, generator and the contrast gate, under vitest and
  `bun test` (universal tier, Rule 2); `it.each` over the option arrays.
- `@vp/ui`: one jsdom spec per primitive with axe; stories as Vitest tests; the preference parse, migration and
  resolution as node specs; `ThemedDocument` through `serverRender`.
- `@vp/components` and the app kits: a jsdom spec per component; the reference wrappers through `renderRoute`
  with MSW.
- Apps: a `serverRender` spec per app over a table of cookies; one Playwright flow per app switching theme, mode
  and a token set without a reload.
- Visual: the workbench suite in CI.

## Open questions

None.

## Definition of Done

- [ ] All acceptance criteria proved with command output in the slice PRs.
- [ ] `docs/design/tokens.json` generated from the package; the guide, the architecture and the spec indexes
      still true.
- [ ] ADR-28 in the SDD; `packages/AGENTS.md` rows for the three new packages; the AGENTS files and
      `docs/standards/design-system.md` updated in the slice that changes what they describe.
- [ ] Ticket status set to `done` and `python3 docs/tickets/gen-index.py` re-run.
