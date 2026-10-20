# Design system architecture

How the design system is built: the packages and what each owns, themes and token sets, the shared option
unions, how a component is shaped and extended, and how an app turns a presentational component into a smart
one. [README.md](README.md) is the look; this is the build. [Ticket 95](../tickets/95-design-system-2.md)
implements it.

---

## 1. Five layers

| Layer | Where | Owns | Knows nothing about |
|---|---|---|---|
| Engine | `@vp/design-tokens` (universal, T2: it takes the appearance vocabulary from `@vp/domain`, T1) | the token schemas, `defineTokenSet`, `defineTheme`, `defineAppearance`, the shared option unions tied to tokens, the CSS generators, the contrast gate | any concrete value |
| Foundation | `@vp/ui` (client, T2) | every token set implementation, the themes, the appearance registry and engine, the primitives (including `Table`), the shared UI types, the copy provider | products, videos, data |
| Shared components | `@vp/components` (client, T3) | only what both apps render today: `PageHeader`, `VideoThumbnail`, the empty, error and section-error states, their skeletons | data, routes, formatting, anything one app alone uses |
| App kit | `apps/client/<app>/src/components/` | the app's own presentational components, shared across its features: web's `AppShell`, `VideoCard`, `Shelf`, `PickOfTheDay`, `Stage`, `Queue`...; studio's `StudioWorkspace`, `DataTable`, `StatCard`, charts | data, routes |
| App features | `apps/client/<app>/src/features/<feature>/` | the smart wrappers (section 5), app-only behaviour (the player, the upload flow), pages | how a primitive is drawn |

Dependencies point down only: an app kit component is built from `@vp/components` and `@vp/ui`, never from
raw elements with its own styling; a smart wrapper is built from the app kit. The specs mirror this:
[primitives/](primitives/README.md), [components/](components/README.md),
[apps/web/](apps/web/README.md), [apps/studio/](apps/studio/README.md).

**Where a new component goes**

1. A generic, product-agnostic control (it would make sense in any app): a primitive in `@vp/ui`.
2. A presentational piece only one app renders: that app's kit, `src/components/<area>/<name>/`. This is the
   default for anything product-shaped.
3. A presentational piece both apps render today: `@vp/components`. It moves there from an app kit the day the
   second app needs it, never earlier, and nothing in it may exist for one app alone. A studio chart or web's
   Pick of the day never belongs there.
4. Behaviour tied to data or one feature: the feature folder, as a smart wrapper or a feature component.

---

## 2. Themes and token sets

A **theme** is an identity: its colour roles per mode, its dataviz palettes, and a choice of default for every
token set. A **token set** is one small, swappable implementation of one design dimension.

| Group | Implementations | Writes |
|---|---|---|
| `typography` | `figtree`, `geist`, `system` | font families (sans, editorial, mono), weight and tracking per type style; imports its fonts |
| `fontSize` | `small`, `default`, `large`, `xlarge` | size and line height per type style |
| `spacing` | `compact`, `default`, `airy` | spacing roles: control and card insets, inline, stack, grid and shelf gaps, section, gutters |
| `sizing` | `small`, `medium`, `large` | control, icon and avatar sizes, touch target, header, rail, card minimum, row thumbnail |
| `radius` | `sharp`, `soft`, `round` | radius per role |
| `border` | `hairline`, `regular`, `bold` | divider, control and focus widths, focus offset |
| `shadow` | `flat`, `soft`, `deep` | elevation 1 to 3 per mode family |
| `ambient` | `off`, `subtle`, `cinematic` | glow on or off, opacity per mode family, blur, sample interval |
| `motion` | `standard`, `calm`, `reduced` | durations and easings; `prefers-reduced-motion` forces `reduced` |

The values are in [tokens.json](tokens.json) under `set.<group>.<implementation>`. The TypeScript and `tokens.json` keys are camelCase (`fontSize`); module paths and HTML attributes are kebab-case (`@vp/ui/tokens/font-size/<id>`, `data-font-size`), and the schema of each group exports its kebab name, the one place the mapping lives.

### Each implementation is its own tiny module

```
packages/client/ui/src/tokens/
  shadow/flat/index.ts        exported as @vp/ui/tokens/shadow/flat
  shadow/soft/index.ts        exported as @vp/ui/tokens/shadow/soft
  shadow/deep/index.ts
  typography/figtree/index.ts imports @fontsource-variable/figtree, newsreader, geist-mono
  ...
```

```ts
// @vp/ui/tokens/shadow/soft
import { defineTokenSet } from '@vp/design-tokens';

export const shadowSoft = defineTokenSet('shadow', 'soft', {
  dark: [/* elevation 1 to 3 */],
  light: [/* elevation 1 to 3 */],
});
```

`defineTokenSet(group, id, values)` parses the values against that group's schema, so a set missing a key
fails to build. `package.json` exports `"./tokens/*"`, so every implementation is its own entry point and an
unused one is never bundled.

### A theme names its defaults by import

```ts
// @vp/ui/themes/sand
import { defineTheme } from '@vp/design-tokens';
import { ambientCinematic } from '@vp/ui/tokens/ambient/cinematic';
import { borderHairline } from '@vp/ui/tokens/border/hairline';
import { fontSizeDefault } from '@vp/ui/tokens/font-size/default';
import { motionStandard } from '@vp/ui/tokens/motion/standard';
import { radiusRound } from '@vp/ui/tokens/radius/round';
import { shadowSoft } from '@vp/ui/tokens/shadow/soft';
import { sizingMedium } from '@vp/ui/tokens/sizing/medium';
import { spacingDefault } from '@vp/ui/tokens/spacing/default';
import { typographyFigtree } from '@vp/ui/tokens/typography/figtree';
import { ref } from '@vp/ui/tokens/ref';

const color = { dark: { bg: ref('sand.950'), /* every role */ }, light: { /* ... */ }, oled: { /* ... */ } };

const dataviz = { /* the four palettes */ };

export const sand = defineTheme({
  id: 'sand',
  name: 'Sand',
  color,
  dataviz,
  defaults: {
    typography: typographyFigtree,
    fontSize: fontSizeDefault,
    spacing: spacingDefault,
    sizing: sizingMedium,
    radius: radiusRound,
    border: borderHairline,
    shadow: shadowSoft,
    ambient: ambientCinematic,
    motion: motionStandard,
  },
});
```

Defaults are imports, not module-path strings: a typo is a compile error, the default is tree-shaken in like
any import, and changing one is still one line. `defaults` must name every group (the type requires it), so a
theme can never leave a dimension undefined.

### One registry decides what ships

```ts
// packages/client/ui/src/appearance/registry.ts
export const appearance = defineAppearance({
  themes: [sand, nocturne],
  defaultTheme: sand,
  offer: {
    typography: [typographyFigtree, typographyGeist, typographySystem],
    fontSize: [fontSizeSmall, fontSizeDefault, fontSizeLarge, fontSizeXlarge],
    spacing: [spacingCompact, spacingDefault, spacingAiry],
    sizing: [sizingSmall, sizingMedium, sizingLarge],
    radius: [radiusSharp, radiusSoft, radiusRound],
    border: [borderHairline, borderRegular, borderBold],
    shadow: [shadowFlat, shadowSoft, shadowDeep],
    ambient: [ambientOff, ambientSubtle, ambientCinematic],
    motion: [motionStandard, motionCalm, motionReduced],
  },
});
```

- `themes` and `defaultTheme`: what the theme picker shows and what a new visitor gets.
- `offer`: the implementations a viewer may switch to at runtime, per group. Only offered sets reach the
  bundle and the generated CSS. Every theme's defaults must be offered: `defineAppearance` asserts it and a spec
  holds it.
- The cookie schema, the settings pages, the workbench toolbar, the visual matrix and the command palette's
  appearance actions all read this one object. Adding a set to `offer` makes it appear in all of them.

### What happens at runtime

```
preference (cookie, account) ─► resolve: override ?? theme default, per group
                                 │
<html data-theme="sand" data-mode="dark" data-shadow="soft" data-spacing="default" ...>
                                 │
generated CSS: [data-theme="sand"]:is([data-mode="dark"], [data-mode="oled"]) { --bg: ... }
               [data-theme="sand"][data-mode="oled"] { --bg: ... }     (only what OLED changes)
               [data-shadow="soft"]:is([data-mode="dark"], [data-mode="oled"]) { --shadow-1: ... }
               [data-spacing="default"] { --gap-stack: 16px; ... }
                                 │
Tailwind utilities read the variables: bg-surface, gap-stack, rounded-card, shadow-2, duration-fast
```

Every offered set compiles to one attribute-scoped block, so a switch is an attribute change: no reload, no
re-render of React, and the server render already carries the right attributes from the cookie.

### The viewer's preference

```ts
// @vp/ui/appearance (shape; the Zod schema is built from the registry)
interface AppearancePreference {
  schema: 2;
  theme: ThemeId | null;           // registry ids; null is the registry's defaultTheme
  mode: ModeOption;                // 'system' | 'dark' | 'light' | 'oled'
  accent: string | null;           // a hex override, null for the theme's accent
  contrast: ContrastOption;        // 'standard' | 'more'
  overrides: Partial<{ [G in TokenGroup]: TokenSetId<G> }>;
}
```

- `overrides` holds only what the viewer changed; a cleared override falls back to the theme's default, so a
  theme switch carries the viewer's own choices over and re-defaults the rest.
- The simple **Density** control writes `spacing` and `sizing` together (comfortable: theme defaults;
  compact: `compact` and `small`). The advanced page sets each on its own.
- It lives in the `vp.appearance` cookie for the server render, and in the account
  ([ticket 97](../tickets/97-account-preferences-api.md)) so it follows the viewer to another device. An app
  can pass its own defaults to the engine: the studio starts on compact spacing and small sizing.

---

## 3. Shared option unions

A prop's string union is a shared vocabulary, not something each component invents.

| Where | What | Examples |
|---|---|---|
| `@vp/design-tokens` | unions that are the keys of a token schema, so they cannot drift from the tokens | `SizeOption` (`xs` to `xl`), `ControlSize` (the keys of `sizing.control`), `IconSize`, `RadiusOption`, `ElevationOption`, `TypeStyleOption`, `SpaceStep`, `ColorRole`, `ToneOption`, `TokenGroup` |
| `@vp/design-tokens`, from `@vp/domain`'s appearance vocabulary | unions the account preference shares with the server, so the engine builds on them rather than redefining them | `ModeOption` (`APPEARANCE_SETTINGS.mode.options`), `ContrastOption` (`APPEARANCE_SETTINGS.contrast.options`), both in `@vp/domain/settings` |
| `@vp/ui` `types/` | UI vocabulary every primitive shares that no token defines | `FillOption` (`solid`, `soft`, `outline`, `ghost`, `plain`), `ShapeOption` (`text`, `icon`, `pill`), `Orientation`, `Align` (`start`, `center`, `end`), `Side` (logical: `block-start`, `block-end`, `inline-start`, `inline-end`) |
| `@vp/domain`, `@vp/api-contracts` | product vocabulary: never redefined in UI code | `VideoStatus`, `VideoVisibility`, `ReactionType` |
| a component's `types.ts` | a union only that component uses | `VideoCardVariant` (`grid`, `shelf`, `row`, `poster`, `spotlight`) |

Every shared union is a `const` array first and a type second, so variant maps and specs iterate the same list:

```ts
// @vp/design-tokens/schema/sizing.ts, where the avatar sizes are keyed by it
export const SIZE_OPTIONS = ['xs', 'sm', 'md', 'lg', 'xl'] as const;
export type SizeOption = (typeof SIZE_OPTIONS)[number];
```

A component narrows a shared union with `Extract` and widens one with a union, in its `types.ts`:

```ts
// @vp/ui/primitives/button/types.ts
import type { ControlSize, ToneOption } from '@vp/design-tokens';
import type { FillOption, ShapeOption } from '../../types';

export type ButtonFill = Exclude<FillOption, 'plain'>;
export type ButtonTone = Extract<ToneOption, 'neutral' | 'accent' | 'danger'>;
export type ButtonSize = ControlSize;
export type ButtonShape = ShapeOption;
```

- `Extract<A, B>` keeps members of a union and `Exclude<A, B>` drops them. (`Pick` and `Omit` are their
  counterparts for object keys.)
- Widening (`SizeOption | 'hero'`) is for a genuinely new value one component needs; if a second component
  needs it, it moves into the shared union instead.
- A props interface never spells a literal union inline. `tests/architecture/shared-unions.test.ts` reads the
  props types of `@vp/ui`, `@vp/components` and the apps' components through the TypeScript compiler API and
  fails on an inline string-literal union outside a `types.ts` file.
- The `tv()` variant maps are typed against the same unions (`satisfies Record<ButtonTone, string>`), so adding a
  member to a union is a type error until every component that accepts it styles it.

---

## 4. How a component is shaped

### Compound by default

A component with more than one region is a root and its parts, sharing state through context:

```tsx
<VideoCard.Root variant="shelf">
  <VideoCard.Thumb src={poster} duration="18:42" progress={0.62} />
  <VideoCard.Byline name="Marta Reis Films" avatarSrc={avatar} />
  <VideoCard.Title asChild><Link to="/watch/$videoId" params={{ videoId }}>Lisbon at night</Link></VideoCard.Title>
  <VideoCard.Meta>412K views · 2 days ago</VideoCard.Meta>
</VideoCard.Root>
```

- The root holds only what applies to the whole (`variant`, `size`, `open`, a callback); parts read it from
  context. Content is children, never a `title`, `hint` or `footer` prop.
- Roots are always `X.Root`, as in Radix, so every compound component reads the same way.
- A part outside its root throws a named error (`VideoCard.Title must be inside VideoCard.Root`), from the
  shared `createCompoundContext(name)` helper in `@vp/ui/lib`.
- Single-element primitives (`Button`, `Badge`, `Input`, `Switch`) are one component over the native element's
  props.

### Open for extension, closed for modification

Each extension point lets an app change what it needs without editing the package:

| Need | Extension point |
|---|---|
| A one-off visual tweak | `className`, merged with `cn` (tailwind-merge resolves conflicts) |
| A different element (a router link, a button) | `asChild` on any part that renders one element |
| A different layout or an extra region | compose the parts differently, or add your own element inside the root |
| A new part that needs the component's state | the exported context hook (`useVideoCard()`), so a part can live in the app |
| An app-local visual variant | `tv({ extend: videoCardStyles, variants: { ... } })` in the app |
| A different look everywhere | a token set or a theme, not a component change |

How the SOLID principles land here:

- **Single responsibility**: a part draws one region; a primitive draws, a component composes, a wrapper
  connects data.
- **Open/closed**: the table above. A new card layout is a composition, never a new boolean on `VideoCard`.
- **Liskov**: a part that wraps an element accepts that element's props (`ComponentPropsWithRef<'a'>`) and
  passes them through, so it can stand in wherever the element could.
- **Interface segregation**: each part takes only its own props, and reads only the slice of context it needs.
- **Dependency inversion**: components receive data and callbacks; links come through `asChild`; copy through
  `useUiCopy()`. Nothing in `@vp/components` imports a router, a query client or the API.

### One folder per component

```
@vp/ui primitives/button/            apps/client/web/src/components/video/video-card/
  button.tsx                           video-card.tsx        Root and parts
  button.variants.ts                   video-card.context.ts createCompoundContext, useVideoCard
  types.ts                             video-card.variants.ts
  button.stories.tsx                   types.ts
  __tests__/button.dom.test.tsx        video-card.stories.tsx
  index.ts                             __tests__/video-card.dom.test.tsx
                                       index.ts              export const VideoCard = { Root, Thumb, ... }
```

`pnpm gen:component <name> --kind primitive|shared|web|studio [--compound]` scaffolds exactly this, including the
context file for a compound one.

---

## 5. Smart wrappers in the apps

`@vp/components` and the app kits are presentational on purpose. Each app adds a thin wrapper per placement
that is smart by design:

- **Base settings are fixed inside the wrapper**: the variant, which parts render, the link target, the
  analytics name. A caller cannot get them wrong because it cannot pass them.
- **Dynamic data comes from hooks**: queries and mutations (`@vp/queries`, the feature's own), formatting
  (`useFormat`), copy (`useT`), permissions (`useCan`), player and queue state.
- **Props are only what varies by placement**: the entity (or its id) and one or two placement facts, such as
  why this card is here.

```tsx
// apps/client/web/src/features/browse/components/feed-video-card.tsx
interface FeedVideoCardProps {
  video: VideoSummary;
  reason?: ShelfReason;
}

export function FeedVideoCard({ video, reason }: FeedVideoCardProps) {
  const format = useFormat();
  const t = useT();
  const progress = useWatchProgress(video.id);
  const { save, enqueue } = useVideoActions(video.id);

  return (
    <VideoCard.Root variant="shelf" videoId={video.id}>
      <VideoCard.Thumb src={video.posterUrl} duration={format.duration(video.durationSeconds)} progress={progress} />
      <VideoCard.Byline name={video.channel.displayName} avatarSrc={video.channel.avatarUrl} />
      <VideoCard.Title asChild>
        <Link to="/watch/$videoId" params={{ videoId: video.id }}>{video.title}</Link>
      </VideoCard.Title>
      <VideoCard.Meta>{t('video.meta', { views: format.compact(video.viewCount), age: format.relative(video.publishedAt) })}</VideoCard.Meta>
      {reason && <VideoCard.Reason>{t(`shelf.reason.${reason.kind}`, reason)}</VideoCard.Reason>}
      <VideoCard.Expanded description={video.descriptionSnippet} onSave={save} onQueue={enqueue} />
    </VideoCard.Root>
  );
}

// a page: {videos.map((video) => <FeedVideoCard key={video.id} video={video} reason={reason} />)}
```

Rules:

- **One wrapper per placement family**, named for it (`FeedVideoCard`, `QueueVideoRow`, `SearchVideoResult`,
  studio's `LibraryVideoRow`), rather than one wrapper with a `placement` prop.
- **Take the entity when the list query already has it**, so a grid of 24 cards does not make 24 requests;
  take an id when the wrapper renders a single entity the cache already holds (`<ChannelChip channelId />`
  reading `useChannel(id)`).
- **A wrapper lives in the feature that owns its data** (`features/browse/components/`), never in the app kit
  or `@vp/components`, which have no data hooks to call.
- **Every wrapper's source is in [data-sources.md](data-sources.md)**: the endpoint, the transport and the fallback
  until the backend ticket lands.
- **Specs** render the wrapper through the app's route helpers with MSW (web Rule 7), and the presentational
  component through its own story.

---

## 6. Sharing between web and studio

| Shared through a package | Stays in an app |
|---|---|
| tokens, themes, token sets, the registry, the appearance engine (`@vp/design-tokens`, `@vp/ui`) | the app kit: web's `AppShell`, `VideoCard`, `Shelf`, `PickOfTheDay`, `Stage`, `Queue`, `CommandPalette`...; studio's `StudioWorkspace`, `DataTable`, `StatCard`, charts |
| primitives, `Table` among them (`@vp/ui`) | smart wrappers, which read each app's own feature hooks |
| `PageHeader`, `VideoThumbnail`, `EmptyState`, `ErrorState`, `SectionError` (`@vp/components`) | the player (web), the upload flow and its progress widget (studio) |
| query factories both apps read (`@vp/queries`) | page layouts, routes, studio-only queries and mutations |

Share when both apps render the same thing today. A piece one app needs stays in that app's kit, and the
second app pulls it into `@vp/components` when it arrives. `@vp/components` staying small is the point: it is
the contract between two apps, and every piece in it is one both must keep working.
