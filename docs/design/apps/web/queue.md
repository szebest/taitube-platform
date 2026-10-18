# Queue

Location: `apps/client/web/src/components/watch/queue/`. Web's app kit, presentational and compound, built from [VideoCard](video-card.md) (`row`), `IconButton`, `ToggleGroup` and `Drawer`.

The viewer's up next list: reorderable rows with the current item marked, and "More like this" below. It carries the "Your queue" signature move and the principle that the viewer owns the queue.

## Anatomy

```
┌──── 1 Your queue ──────────────────────────────┐
│ 2 3 / 12      [3 shuffle] [4 repeat] [5 autoplay]│
├────────────────────────────────────────────────┤
│ ::  ┌────────┐ Lisbon trams, no music        [x] │  6 row
│ ::  ┌────────┐ Shot entirely on a 1998...        │  7 current, accent-soft
│     │ ▓▓▓░░░ │ Marta Reis Films       NOW PLAYING│
├──────────── 8 More like this ──────────────────┤
│     ┌────────┐ Alfama at 5 a.m.                  │
└────────────────────────────────────────────────┘
```

| # | Part | Notes |
|---|---|---|
| 1, 2 | `Header` | `title`, queue name; position in `mono` ("3 / 12"); a collapse button on medium |
| 3 to 5 | `Modes` | `IconButton` toggles: shuffle, repeat, autoplay |
| 6 | `Item` | drag handle at the start, a `row` card (`size="sm"`, 120 px thumbnail), a remove button at the end |
| 7 | current `Item` | `accent-soft`, `aria-current="true"`, "Now playing" `overline` in `accent-ink` |
| 8 | `Recommendations` | a second labelled list of `row` cards with the reason "Recommended", never confused with the queue |

## Props

```ts
// types.ts
export type QueueLayout = 'side' | 'below' | 'sheet';
export type QueueRepeat = 'off' | 'all' | 'one';
```

```ts
interface QueueRootProps {
  currentId: string;
  layout?: QueueLayout;
  onReorder: (id: string, toIndex: number) => void;
  onRemove: (id: string) => void;
  onSelect: (id: string) => void;
}

interface QueueModesProps {
  shuffle: boolean;
  repeat: QueueRepeat;
  autoplay: boolean;
  onChange: (next: { shuffle: boolean; repeat: QueueRepeat; autoplay: boolean }) => void;
}
```

Three callbacks are the whole contract with the viewer's list. `layout` follows the breakpoint when omitted (the sheet wraps the list in a `Drawer`). Keyboard-reorder announcements ("moved to position 2 of 12") are built from `Item`'s `title` and index with `useUiCopy()`. Drag runs on a headless engine the wrapper injects through `onReorder`; the kit ships the visuals and the keyboard path. Empty is an [EmptyState](../../components/empty-state.md), loading is skeleton rows as children.

## Variants

| Layout | Difference |
|---|---|
| `side` | right column on expanded and up, sticky, scrolls inside up to the stage's height |
| `below` | theater and below expanded: full width beside the discussion |
| `sheet` | compact: the list in a `Drawer` opened by the Queue button |

## States

| State | What changes |
|---|---|
| current | `accent-soft` row, now-playing label, an equaliser glyph on the thumbnail while playing |
| picked up | row lifts with `elevation-2`, handle `aria-pressed`, others show a drop gap |
| single item | heading says so, reorder controls hidden |
| empty | [EmptyState](../../components/empty-state.md) "Nothing queued" with a "Browse" action |
| removing | row collapses and fades; Undo `Toast` by the wrapper |
| loading recommendations | three `row` skeletons under the heading |

## Responsive behaviour

Compact: a sheet, rows 76 px, handles `layout.touch-target` wide, drag by long press. Medium: `below`, two columns allowed. Expanded: `side`, 400 px. Large: `side`, 420 px; theater switches to `below`.

## Skeleton

`QueueSkeleton`: card, padding 14 px, header bar 160 by 28, five rows 76 px high each with a 120 by 67.5 thumbnail, 4 px gap. Rules in [skeletons](../../components/skeletons.md).

## Motion

Rows slide after a drop at `base` with `settle`. Pick up lifts at `fast`. Remove collapses and fades at `base` with `exit`. Current change crossfades at `fast`. Reduced motion: rows jump; the glyph is static.

## Accessibility

- A `ul` in a `section` labelled by the heading; recommendations are a second labelled `ul`.
- Keyboard reorder: focus a handle, Space picks up, Up and Down move one place, Space drops, Escape cancels; each step writes to an `aria-live="assertive"` region.
- Enter plays a row. Delete or the remove button removes it, focus moving to the next row.
- Mode buttons are toggles; repeat cycles off, all, one and its label names the state.

## Extension points

- `className` on every part, merged with `cn`.
- `asChild` on `Item` and `Header`.
- `useQueue()` returns `{ currentId, layout, select, remove }` for an app-local part, such as a "Save queue" button.
- `tv({ extend: queueStyles, variants: { ... } })` for a local look.

## Smart wrappers

| Wrapper | Folder (`features/...`) | Props | Hooks |
|---|---|---|---|
| `WatchQueue` | `watch/components/` | none | `usePlaybackQueue`, `useReorderQueue` (the drag engine), `useRelatedVideos(currentId)`, `useT` |
| `QueueVideoRow` | `watch/components/` | `video: VideoSummary`, `current?: boolean` | `useFormat`, `usePlaybackQueue` |

`WatchQueue` fixes `onSelect` to start playback and renders `QueueVideoRow` for queue and recommendation items.

## Used by

[59](../../../tickets/59-video-watch-page-responsive-layout-enhancements.md) the queue, More like this, keyboard reorder; [73](../../../tickets/73-frontend-youtube-playlists-library-player-queue.md) fills it from a playlist and the now playing bar.

## Workbench stories

Current video alone; twelve items with the current in the middle; item dragged; keyboard reorder (play function); shuffle, repeat one, autoplay; remove with Undo; empty; recommendations loading; compact sheet; RTL (handle flips); skeleton.
