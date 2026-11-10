# Design system standards

How to add to the design system. The build is [docs/design/architecture.md](../design/architecture.md), the look is
[docs/design/README.md](../design/README.md), and a UI change is done when it meets
[the polish bar](../design/README.md#9-the-polish-bar). This page is the recipes and the rules the
architecture tests hold. Ticket: [95](../tickets/95-design-system-2.md).

## Where things live

| What | Where | Import |
|---|---|---|
| Schemas, generators, option unions | `packages/universal/design-tokens` | `@vp/design-tokens` |
| A token set | `packages/client/ui/src/tokens/<kebab-group>/<id>/` | `@vp/ui/tokens/<kebab-group>/<id>` |
| A theme | `packages/client/ui/src/themes/<name>/` | `@vp/ui/themes/<name>` |
| What ships | `packages/client/ui/src/appearance/registry.ts` | `@vp/ui/appearance/registry` |
| A primitive | `packages/client/ui/src/primitives/<name>/` | `@vp/ui` |
| A shared component | `packages/client/components/src/<area>/<name>/` | `@vp/components` |
| An app kit component | `apps/client/<app>/src/components/<area>/<name>/` | `#app/components/...` |
| A smart wrapper | `apps/client/<app>/src/features/<feature>/components/` | the feature |

A component moves up a row only when a second consumer needs it, never earlier. A shared component is imported by
both apps; one app alone means it belongs in that app's kit.

## Commands

| Command | Does |
|---|---|
| `pnpm gen:token-set <group> <id> --from <id>` | copies a set, registers it, runs `gen:tokens` |
| `pnpm gen:theme <id> [--from sand]` | copies a theme, registers it, runs `gen:tokens` |
| `pnpm gen:component <name> --kind primitive\|shared\|web\|studio [--area <area>] [--compound]` | scaffolds the folder |
| `pnpm gen:tokens` | writes `docs/design/tokens.json` and `src/styles/generated/*.css`; CI runs `--check` |

Never edit `tokens.json` or `generated/` by hand. A value changes in its set or theme module, then `pnpm gen:tokens`.

## Add a token set

1. `pnpm gen:token-set spacing airy --from default`. The module is data only: one `defineTokenSet` call.
2. Tune the values. A typography set names font families; the font package import goes in `src/styles/fonts.css`,
   because `gen:tokens` loads the set under tsx and tsx cannot import CSS.
3. The script registers it in `appearance/registry.ts`. Only an offered set ships and only an offered set reaches a
   viewer's settings.
4. Look at a story under the new set in the workbench toolbar, then run `pnpm gen:tokens` again if you tuned
   after the scaffold.

## Add a theme

1. `pnpm gen:theme dusk --from sand`.
2. In `src/themes/dusk/index.ts`, set the colour roles per mode, the dataviz palettes and `defaults` (one set per
   group). A role names a ramp step with `ref('sand.950')` or holds a plain hex when it has no step.
3. The contrast gate (`src/themes/__tests__/themes.test.ts`) walks every mode and required pair. A failing pair is
   fixed in the theme, never by relaxing the gate.
4. Changing the product default theme is one line in the registry.

## The appearance on `<html>`

`<html>` carries `data-theme`, `data-mode`, `data-contrast`, `data-density` and one `data-<group>` per token group.
`data-contrast` is `standard` or `more`: the preference `auto` (the default) resolves to `more` while the system asks
for `prefers-contrast: more`, in the pre-paint script and in `resolveAppearance`, until the viewer chooses. A style that
depends on density reads `data-density` (`compact` is compact spacing with small sizing), never the two token ids.

The one playback host takes its layer from where it sits: `z-sticky` while docked on a watch page, under the header, and
`z-pip` as the mini player, above the rail and the tab bar and under every overlay.

## Add a primitive

1. `pnpm gen:component <name> --kind primitive` (add `--compound` for more than one region).
2. Compound for anything with several regions (`X.Root` plus parts sharing context through
   `createCompoundContext`); a single element is one component over native props.
3. Props use the shared unions from `@vp/design-tokens` and `src/types/`, narrowed with `Extract` and `Exclude`
   in `types.ts`. A props type never spells an inline string union.
4. `tv()` only for a real variant prop; static classes inline through `cn(..., className)`.
5. Export the extension points: `className`, `asChild` (through `Slot` from `@vp/ui`), the context hook of a
   compound component and its `tv()` styles.
6. Radix and `@dnd-kit/*` are imported here only.
7. The folder holds `<name>.tsx`, `index.ts`, `__stories__/<name>.stories.tsx` and `__tests__/<name>.dom.test.tsx`.

## Add a shared component, an app kit component

Same recipe with `--kind shared` or `--kind web|studio --area <area>`. It is presentational: no data hook, no
router, no API client. Product words arrive as children or props; words it prints itself come from
`useUiCopy()` (below).

## Add a smart wrapper

A wrapper is the one place a placement meets data. It lives in the feature that owns the data, fixes the base
settings (variant, parts, link target), reads dynamic data from hooks and takes only the entity and one or two
placement facts. Copy `features/browse/components/feed-video-card.tsx` (web) or
`features/content/components/library-video-row.tsx` (studio); the rules are
[architecture section 5](../design/architecture.md#5-smart-wrappers-in-the-apps). A page ticket owns the wrappers
it uses and builds the kit part under them only if the kit lacks it.

## Rules the architecture tests hold

Each row has a fixture proving it fires; the list is [ARCHITECTURE.md section 6](../../ARCHITECTURE.md).

- No raw colour, ramp step or Tailwind palette class outside a theme; logical properties only.
- No inline string-literal union in a props type outside `types.ts`.
- Token values are declared only under `ui/src/tokens/` and `ui/src/themes/`, and only the registry imports them.
- No raw `z-<n>`, `z-[<n>]`, `-z-<n>`, `zIndex` or `z-index`: a layer is a role of `scale.z`
  ([foundations/shape-elevation.md](../design/foundations/shape-elevation.md#layering)).
- The ambient glow is one layer on the `ambient` role, drawn by the shell behind the header and rail from the stage a
  page registers (`useAmbientGlow`); no page paints a glow of its own.
- Chrome is never selectable and content always is, by one `user-select` rule in `base.css`; see
  [Selectable text](#selectable-text).
- No stylesheet outside `@vp/ui`'s styles, no CSS module and no SCSS.
- Every component folder has its component, index, story and jsdom spec.
- `@vp/components` exports are each imported by both apps.
- `docs/design/lib/` and `tt-` classes stay in the docs.

## Scroll lock

Radix locks `body` for a Dialog, Drawer, Menu and Select, and gives the scrollbar's width back with a `margin-right`
of its own. `html { scrollbar-gutter: stable }` already keeps that width reserved while the lock hides the scrollbar,
so `base.css` holds the two rules, the gutter and `html body[data-scroll-locked] { margin-inline: 0 }`, and no
primitive pads, overrides or works around the lock. `layout-stability.test.ts`
in each app's `e2e/` opens every locking primitive over a page with a 15 px classic scrollbar and holds the content's
box and `scrollY` where they were, open and closed.

## Surface roles

Every ground is one role of the colour map; a component picks the role of what it is, never a nearby value.

| Role | Used for |
|---|---|
| `bg` | the page, `html` and `body` (set once in `base.css`), sticking chrome (header, chip bar, page header, tab bar), the rail |
| `surface` | content: cards, tables, panels, settings tiles |
| `raised` | what floats over content: menus, popovers, dialogs, drawers, toasts, the now-playing bar |
| `media` and `on-media` | what shows a picture or a video, and what is drawn on it: thumbnails, posters, the player frame, its controls, captions and title (black and white in every theme) |
| `tint` | hover |
| `tint-strong` | pressed |
| `accent-soft` | selected |

In the light modes `raised` and `surface` are the same value: a floating layer is told from a card by its border
and shadow, not by a lighter ground, and no shade lighter than white exists. The player container sets
`data-mode="dark"` so its native controls and scrollbars draw dark, and `bg-media` so the letterbox is black in
every theme; `data-theme` carries a theme id only. The control bar and the title scrim carry `data-media-controls`:
`base.css` gives everything inside it the `on-media` colour, a shadow under glyphs and text, and a focus ring that is
white with a black halo, so a control is seen on a black frame and on a white one; the seek bar is `media-seek`
with its played, buffered and rest colours. `surface-roles.test.ts` holds the page ground and the player.

## Selectable text

One `@layer base` rule in `base.css` sets `user-select: none` on every control (`button`, `summary`, `kbd`, nav
links, the ARIA roles tab, menuitem, option, switch, checkbox, radio, slider), on the chrome slots avatar, badge,
chip, kbd, label, tooltip and video thumbnail, and on anything painted `cursor-pointer` or `touch-none`. A primitive
or component never writes `select-none`. Content (titles, descriptions, comments, chat, table cells, hints, errors)
is selectable by default; where it sits inside a chrome ancestor it opts back in with `select-text`. A new control
needs no line of its own if it paints `cursor-pointer`; a new chrome slot is added to the rule's list.
`user-select.test.ts` holds that and `e2e/user-select.test.ts` reads the computed value in the browser.

## Motion

A transition animates compositor properties (`transform`, `opacity`, colour, shadow) over a duration token;
`transition-all`, a literal `duration-<n>`, and a transition of a layout property fail the `zero-matches` design
rows. Every shared control has motion and every moving one a `motion-reduce` guard (`motion.test.ts`), and
`base.css` reads `prefers-reduced-motion` once. The rest is [motion.md](../design/foundations/motion.md).

Use the `animate-*` utilities and the motion tokens (`duration-fast|base`, `ease-enter|exit|settle`); never a literal
duration. Under `motion: reduced`, chosen or forced by `prefers-reduced-motion`, nothing moves: opacity and colour
only, skeletons static, the live dot static beside its label, view transitions off, autoplay previews paused, and a
surface opened from the keyboard never animates its open. Write the reduced path with `motion-reduce:` and
`motion-safe:`. A selection indicator slides through `useSlidingIndicator` and `slidingIndicatorBase`
(`@vp/ui`), not a new measurement. Detail: [foundations/motion.md](../design/foundations/motion.md).

## Copy

A primitive or shared component never hardcodes a word it prints (a close button label, a loading status). It
reads `useUiCopy()`, whose keys are `UI_COPY_KEYS` in `@vp/ui`; add a key there and its catalogue entry, and each
app fills it through `@vp/queries`' `AppWords`. A kit component takes product words from its caller. Numbers and
dates go through `@vp/intl-react`; see [formatting-and-i18n.md](formatting-and-i18n.md).

## Stories and visual baselines

Every component has a story beside it covering each state in
[the guide's section 8](../design/README.md#8-surfaces), and an interaction story where it moves. The workbench
renders each under every theme, set and mode ([workbench AGENTS.md](../../packages/client/workbench/AGENTS.md)).
Baselines are PNGs in Git LFS, drawn in the pinned Playwright image and never on a Mac; a PR runs the stories its
diff can move. Redraw with the command in the workbench AGENTS.md and review the images in the PR.

## Check before done

```bash
pnpm gen:tokens --check
pnpm boundaries
pnpm test:architecture
pnpm --filter @vp/workbench test:stories
```

Plus typecheck, lint and the specs of the packages you touched ([testing.md](testing.md)).
