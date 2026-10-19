# ChannelHeader

Location: `apps/client/web/src/components/channel/channel-header/`. Web's app kit, presentational and compound, built from `Avatar`, `Button`, `Tabs`, `AspectRatio` and `Badge`.

The top of a channel page: a banner tinted by the latest upload, the identity row and the tabs. It carries the "Ambient stage" move on the banner and shares the identity row with the channel result in search.

## Anatomy

```
┌──────────────────────────────────────────────────────────────────────┐
│ 1 banner, 6:1, tinted by the ambient sample of the latest upload      │
└──────────────────────────────────────────────────────────────────────┘
  ┌────────┐  2 Marta Reis Films                         [ 5 Subscribe ] [bell]
  │ 3 avatar│  4 @martareis · 284K subscribers · 86 videos
  └────────┘  Short films shot on tape, mostly at night.  6 more
  Home   Videos   Shorts   Live   Playlists   Community   About     7 tabs
```

| # | Part | Notes |
|---|---|---|
| 1 | `Banner` | 6:1 from expanded, 3:1 on compact, radius `card`; without one, a gradient from `glowColor` over `surface` at the same height |
| 2 | `Identity` name | `display` on large, `headline` below; verified mark; `text-wrap: balance` |
| 3 | `Identity` avatar | `avatar.xl` (72 px on compact); a `live` ring when streaming |
| 4 | `Identity` stats | `body-sm`, `fg-muted`, finished strings |
| 5 | `Subscribe` | same states as [EngagementBar](engagement-bar.md); a bell `IconButton` once subscribed |
| 6 | `Bio` | two lines with a "more" link to About |
| 7 | `Tabs` | `Tabs` as links; a tab whose feature has not shipped is not rendered |

## Props

```ts
// types.ts
export type ChannelHeaderLayout = 'full' | 'identity';
```

```ts
interface ChannelHeaderRootProps {
  layout?: ChannelHeaderLayout;
  glowColor?: string;
}

interface ChannelHeaderIdentityProps {
  name: string;
  handle: string;
  avatarSrc?: string;
  stats?: string;
  verified?: boolean;
  live?: boolean;
}
```

Banner, identity, actions and tabs are parts. A creator on their own channel omits `Subscribe` and puts an "Open in Studio" button in `Actions`. An absent `Banner` renders the gradient. `glowColor` is a sampled CSS colour painted as a tint (`data-ambient="off"` removes it). Subscribe, Subscribed and the counts are strings the wrapper supplies.

## Variants

| Layout | Difference |
|---|---|
| `full` | banner, identity row and tabs |
| `identity` | only the identity row, 72 px avatar, no banner or tabs: the strong channel match above blended search results ([74](../../../tickets/74-frontend-multi-resource-search-discovery-ui.md)) |

## States

| State | What changes |
|---|---|
| subscribed | secondary `Subscribed` with a check; the bell appears |
| pending | spinner in the button, optimistic result held |
| live | avatar `live` ring and a `LIVE` badge beside the name linking to the live tab |
| no banner, no bio | gradient at the same height; the bio row is absent |
| tab active | `accent-ink` label, 2 px `accent` underline, `aria-current="page"` |
| unavailable channel | the wrapper renders [ErrorState](../../components/error-state.md) instead |

## Responsive behaviour

Compact: banner 3:1 full bleed, avatar overlapping its lower edge, name `title-lg`, Subscribe full width, tabs scroll with a fade. Medium: banner 4:1, one-line identity, `headline`. Expanded: banner 6:1 inside the gutter. Large: `display`, bio at 68 ch.

## Skeleton

`ChannelHeaderSkeleton`: banner 6:1 block (3:1 compact), radius `card`; `avatar.xl` circle (72 px compact); bars 280 by 50, 220 by 20, 360 by 23; subscribe 120 by `control.md`; tab row `control.md` high. Rules in [skeletons](../../components/skeletons.md).

## Motion

Banner tint fades in at `slow` once sampled. The tab underline moves at `base` with `settle`. Subscribe swap `fast`. Reduced motion: no fade, the underline jumps.

## Accessibility

- The identity row is a `header` in `main` with the name as the page `h1`. Tabs are a labelled `nav` of links with `aria-current="page"`, not `role="tab"`, since each is a route.
- Banner `alt` only when it carries information. The `live` ring is paired with badge text.
- Subscribe is a toggle with `aria-pressed`, announced politely. Tint is decorative; contrast is checked against `bg` and `surface`.

## Extension points

- `className` on every part, merged with `cn`.
- `asChild` on `Tab`, `Identity` and `Banner`.
- `useChannelHeader()` returns `{ layout, glowColor }` for an app-local part.
- `tv({ extend: channelHeaderStyles, variants: { ... } })` for a local look.

## Smart wrappers

| Wrapper | Folder (`features/...`) | Props | Hooks |
|---|---|---|---|
| `ChannelPageHeader` | `channels/components/` | `channel: Channel` | `useSubscription(channel.id)`, `useCan` (own channel), `useAmbientSample(latestPosterUrl)`, `useChannelTabs`, `useFormat`, `useT` |
| `ChannelResultHeader` | `search/components/` | `channel: ChannelCard` | `useSubscription`, `useFormat`, `useT` |

`ChannelPageHeader` fixes `layout="full"`, builds the tabs from the shipped features, and shows "Open in Studio" when the viewer owns the channel.

## Used by

[58](../../../tickets/58-modern-browse-layout-microinteractions-motion.md) the channel page replacing `UserPage`; [74](../../../tickets/74-frontend-multi-resource-search-discovery-ui.md) the `identity` layout as a result.

## Workbench stories

Full with banner; gradient fallback; subscribed with bell; live; own channel; long name and handle; shipped tabs only; identity; compact; RTL; skeleton.
