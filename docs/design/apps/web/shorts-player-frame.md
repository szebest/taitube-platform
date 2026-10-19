# ShortsPlayerFrame

Location: `apps/client/web/src/components/shorts/shorts-player-frame/`. Web's app kit, presentational and compound, built from `IconButton`, `AspectRatio`, `Progress` and the [Stage](stage.md) ground.

The Shorts surface: a 9:16 player centred on the stage, the action column beside it, previous and next buttons on pointer devices, and the discussion as a sheet. It ships now as a shell for `/shorts`, rendering its empty state until the feature wires data ([95](../../../tickets/95-design-system-2.md) section 8).

## Anatomy

```
        ┌────────────────┐
  [^]   │                │   ┌──┐ 3
  1     │  2 player      │   │L │ Like 24K
  [v]   │  9:16          │   │▢ │ Discussion
        │ title, channel │   │> │ Share
        │ ▓▓▓▓░░ 4       │   └──┘
        └────────────────┘
```

| # | Part | Notes |
|---|---|---|
| 1 | `Previous`, `Next` | `control.lg` `IconButton`s, pointer devices only, at the inline start |
| 2 | `Player` | 9:16 on a `media` ground (Stage `vertical`), radius `card`, height `min(100dvh - layout.header - 32px, 900px)` |
| 3 | `Actions` | `control.lg` `IconButton`s with a `caption` count below, at the inline end |
| 4 | progress | 3 px, flush to the bottom edge, `accent` |

## Props

```ts
// types.ts
export type ShortsFrameState = 'ready' | 'loading' | 'error' | 'empty' | 'ended';
export type ShortsActionsLayout = 'beside' | 'overlay';
```

```ts
interface ShortsPlayerFrameRootProps {
  state?: ShortsFrameState;
  layout?: ShortsActionsLayout;
  onPrevious?: () => void;
  onNext?: () => void;
}

interface ShortsPlayerFrameActionProps {
  icon: ReactNode;
  count?: string;
  pressed?: boolean;
  onSelect: () => void;
}
```

Previous and next appear when their callback is given (no first or last flag). `layout` follows the breakpoint. Their labels come from `useUiCopy()`. The discussion is a [CommentThread](comment-thread.md) `sheet` the wrapper opens in its `Drawer`; the frame only emits the select.

## Variants

| Layout | Difference |
|---|---|
| `beside` | action column beside the frame, medium and up |
| `overlay` | compact: the column over the video at the inline end on a `scrim` gradient, the caption at the bottom start |

## States

| State | What changes |
|---|---|
| paused | a centred 64 px play glyph on `scrim` |
| muted | a speaker-off marker at the top end, tap to unmute |
| liked | the Like action takes `accent-soft` and `accent-ink` |
| loading | a spinner after 400 ms |
| error | a centred message and retry inside the frame |
| empty | the `/shorts` shell: an [EmptyState](../../components/empty-state.md) `page` line ("Shorts will appear here") |
| ended | next disabled and a "You are all caught up" line |

## Responsive behaviour

Compact: full width and height under the header, actions overlaid, swipe for next and previous, the tab bar stays. Medium: frame up to 405 px, actions beside. Expanded: 450 px, with buttons. Large: up to 506 px, arrows at the outer sides.

## Skeleton

`ShortsPlayerFrameSkeleton`: a 9:16 `media` block, an action column of four `control.lg` circles at 16 px gap. Rules in [skeletons](../../components/skeletons.md).

## Motion

Next and previous slide vertically at `slow` with `settle`. Like scales at `fast`; the paused glyph fades at `fast`. Reduced motion: switching is a cut, glyphs fade only.

## Accessibility

- A `region` labelled "Shorts player". Up and Down arrows, `J` and `K` move between Shorts; Space plays and pauses; `M` mutes.
- Actions are toggles with the count in the name; discussion opens a modal sheet with focus trap and return.
- A polite live region announces the new title and channel. Swipe is an enhancement: every gesture has a button. Autoplay respects the motion setting and starts muted.

## Extension points

- `className` on every part, merged with `cn`.
- `asChild` on `Action` and `Caption`.
- `useShortsPlayerFrame()` returns `{ state, layout, paused, muted }` for an app-local overlay.
- `tv({ extend: shortsPlayerFrameStyles, variants: { ... } })` for a local look.

## Smart wrappers

| Wrapper | Folder (`features/...`) | Props | Hooks |
|---|---|---|---|
| `ShortsFeedFrame` | `shorts/components/` | `short: VideoSummary` | `useShortsNavigation`, `useReaction(short.id)`, `useVideoActions`, `useFormat`, `useT` |

It fixes the actions to Like, Discussion, Share and Queue, opens `ShortsCommentSheet`, and maps feed and player state to `ShortsFrameState`.

## Used by

[95](../../../tickets/95-design-system-2.md): the `/shorts` shell in web.

## Workbench stories

Ready with side actions; overlay at compact; paused and muted; liked; loading and error; empty; last Short; RTL (column mirrors, arrows keep their meaning); skeleton.
