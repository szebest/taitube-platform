# VideoCard

Location: `packages/client/components/src/video-card/` (`@vp/components`), presentational and compound, built from `VideoThumbnail` (`@vp/components`) and `@vp/ui` primitives.

The one card for every video: thumbnail, byline, title, meta and a reason. It carries byline cards, reason labels, expand on hover and, through `spotlight`, Pick of the day.

## Anatomy

```
┌──────────────────────────────┐
│ [1 4K]                       │   frame: VideoThumbnail, radius thumb
│                      2 18:42 │   duration, mono, bottom end
│▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░│ 3 progress, flush to the bottom edge
└──────────────────────────────┘
 ● 4 MARTA REIS FILMS                 byline
 5 Shot entirely on a 1998            title, two lines at most
   camcorder: Lisbon at night   [6 ...]
 7 412K views · 2 days ago
 o 8 Because you watched Porto        reason
```

| # | Part | Notes |
|---|---|---|
| 1 | `Thumb` children | `Badge`: `4K`, `NEW`, `PREMIERE`; `LIVE` uses `live` and `on-live` |
| 2 | `Thumb` `duration` | `VideoThumbnail.Duration`: `mono`, `tabular-nums`, `scrim` chip, radius `xs` |
| 3 | `Thumb` `progress` | `VideoThumbnail.Progress`, `accent` on `tint-strong`, only when partly watched |
| 4 | `Byline` | `overline`, `fg-muted`, `Avatar` at `avatar.xs` |
| 5 | `Title` | `title`, two lines, `text-wrap: balance` |
| 6 | `Menu` | `IconButton`, on hover and focus, always visible on touch |
| 7 | `Meta` | `body-sm`, `fg-muted` |
| 8 | `Reason` | `caption`, `accent-ink`, leading dot; shelves only |

## Props

```ts
// types.ts
import type { SizeOption } from '@vp/design-tokens';

export type VideoCardVariant = 'grid' | 'shelf' | 'row' | 'poster' | 'spotlight';
export type VideoCardState = 'rest' | 'live' | 'premiere' | 'unavailable';
export type VideoCardSize = Extract<SizeOption, 'sm' | 'md'>;
```

```ts
interface VideoCardRootProps {
  variant?: VideoCardVariant;
  state?: VideoCardState;
  size?: VideoCardSize;
  videoId?: string;
}

interface VideoCardThumbProps {
  src: string;
  alt?: string;
  duration?: string;
  progress?: number;
  previewSrc?: string;
}
```

`size` only affects `row`; `progress` is 0 to 1; a part that is not a child is not rendered. `VideoCard.Thumb` wraps the `VideoThumbnail` parts, so frame, scrim chip, progress and `view-transition-name` come from `@vp/components`; the card adds lift, preview and the expand trigger. `Thumb` passes the root's `videoId` to `VideoThumbnail.Root` (the shared element name [Stage](stage.md) uses too, so there is no `viewTransitionName` prop) and `aspect` (`portrait` for `poster`, else `landscape`).

## Variants

| Variant | Layout |
|---|---|
| `grid` | fluid, columns from `layout.card-min`; thumbnail on top, all regions |
| `shelf` | fixed width in a [Shelf](shelf.md) (260 to 320 px), reason shown |
| `row` | thumbnail at the start, `layout.row-thumb` for `md` (168 px), 120 px for `sm` (the [Queue](queue.md)) |
| `poster` | 9:16, 160 to 180 px, title over a `scrim` gradient, no byline; Shorts |
| `spotlight` | the hero in [PickOfTheDay](pick-of-the-day.md): thumbnail to 640 px, `display` title, `editorial` description |

## States

| State | What changes |
|---|---|
| hover | thumbnail lifts 2 px with `elevation-2`, `slow` with `settle`; transform only |
| expanded | pointer only, after 500 ms: a `raised` panel at `elevation-3` with preview, two description lines, Save and Queue; never on touch or keyboard |
| focus | one `focus-ring` on the link; the menu appears |
| live | `LIVE` badge, viewer count in `Meta` |
| premiere | `PREMIERE` badge, start time in place of the duration |
| unavailable | `tint` ground and icon, title in `fg-muted`, link `aria-disabled` |

Compact: one column at `gutter-compact`, no expand. Medium: two columns. Expanded: columns by `card-min`, expand on.

## Skeleton

`VideoCardSkeleton` takes `variant` and `count`; layout shift is zero by these sizes ([skeleton rules](../../components/skeletons.md)).

| Variant | Dimensions |
|---|---|
| `grid` | thumbnail 16:9, radius `thumb`; 10 px gap; byline `avatar.xs` dot plus bar 120 by 13; title bars 100 % and 68 % by 22; meta bar 140 by 20; height = width x 9/16 + 143 px |
| `shelf` | as grid plus reason bar 160 by 16; width 260 to 320; height = width x 9/16 + 169 px |
| `row` | thumbnail 168 by 94.5 (120 by 67.5 for `sm`); 12 px gap; title bars 100 % and 60 % by 22; meta 120 by 20 |
| `poster` | 9:16, 160 to 180 wide, no bars |
| `spotlight` | see [PickOfTheDay](pick-of-the-day.md) |

## Motion

Lift `slow` with `settle`. Expand after 500 ms: `slow` with `settle`, panel in with `enter`, out with `exit` at `base`. Thumbnail to stage: `cinematic`. Reduced motion: no lift, expand or shared element; hover is a `tint` overlay.

## Accessibility

An `article`; the title link is stretched over the thumbnail: one tab stop plus the menu and byline link. `alt=""` unless passed. Progress is `role="progressbar"`; the visual duration is `aria-hidden` and a spoken one is read. Expand is no tab stop; Save and Queue are in the menu.

## Extension points

- `className` on every part, merged with `cn`.
- `asChild` on `Title`, `Byline` and `Thumb`: the wrapper passes its router `Link`.
- `useVideoCard()` returns `{ variant, state, size, videoId }`, so an app-local part (a "Watched" tick) reads the same context.
- `tv({ extend: videoCardStyles, variants: { ... } })` for a local variant; a new layout is a composition, never a boolean.

## Smart wrappers

One wrapper per placement, each fixing `variant`, parts and link target; props are the entity and a placement fact.

| Wrapper | Folder (`features/...`) | Props | Hooks |
|---|---|---|---|
| `FeedVideoCard` | `browse/components/` | `video: VideoSummary`, `reason?: ShelfReason` | `useFormat`, `useT`, `useWatchProgress`, `useVideoActions` |
| `ShortPosterCard` | `shorts/components/` | `video: VideoSummary` | `useFormat`, `useT` |
| `QueueVideoRow` | `watch/components/` | `video: VideoSummary`, `current?: boolean` | `useFormat`, `usePlaybackQueue` |
| `SearchVideoResult` | `search/components/` | `result: SearchResultItem` | `useFormat`, `useT`, `useVideoActions` |
| `HistoryVideoRow` | `library/components/` | `item: WatchHistoryItemView` | `useFormat`, `useRemoveFromHistory` |

```tsx
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
```

## Used by

[58](../../../tickets/58-modern-browse-layout-microinteractions-motion.md) grid, shelf, poster, spotlight; [59](../../../tickets/59-video-watch-page-responsive-layout-enhancements.md) `row` in More like this and the queue; [73](../../../tickets/73-frontend-youtube-playlists-library-player-queue.md) history and playlists; [74](../../../tickets/74-frontend-multi-resource-search-discovery-ui.md) search results.

## Workbench stories

Each variant and state, long title and channel, `1:02:44`, right-to-left, skeletons.
