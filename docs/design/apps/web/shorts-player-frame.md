# ShortsPlayerFrame

Location: `apps/client/web/src/components/shorts/shorts-player-frame/`. Web's app kit, presentational and compound, built from `IconButton`, `AspectRatio`, `Slider` and the [Stage](stage.md) ground.

One Short's surface: a 9:16 player centred on the stage, the action column beside it, previous and next buttons on pointer devices, a toolbar over the picture's corner and a seek bar along its foot. The frame is one slide of the feed; the feed's scroller is the one `region`, and it owns the keys ([136](../../../tickets/136-frontend-ui-and-feel-overhaul-web-and-studio.md) slice d2).

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
| 4 | `Progress` | a `Slider` named by `label`, flush to the bottom edge, `accent`; the thumb shows on focus, `onSeek` takes 0 to 1 |
| 5 | `Toolbar` | a `toolbar` named by `label` at the top end: mute, captions, speed, which the wrapper composes |

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
  playback?: { paused: boolean; onTogglePlay: () => void };
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
| liked | the Like action takes `accent-soft` and `accent-ink` |
| loading | a spinner after 400 ms |
| error | a centred message and retry inside the frame |
| empty | the `/shorts` shell: an [EmptyState](../../components/empty-state.md) `page` line ("Shorts will appear here") |
| ended | next disabled and a "You are all caught up" line |

## Responsive behaviour

Compact: full width and height under the header, actions overlaid, a swipe scrolls the feed (scroll snap), the tab bar stays. Medium: frame up to 405 px, actions beside. Expanded: 450 px, with buttons. Large: up to 506 px, arrows at the outer sides.

## Skeleton

`ShortsPlayerFrameSkeleton`: a 9:16 `media` block, an action column of four `control.lg` circles at 16 px gap. Rules in [skeletons](../../components/skeletons.md).

## Motion

The feed scrolls and snaps natively; a key moves it smoothly, and a cut under reduced motion. Like scales at `fast`; the paused glyph fades at `fast`.

## Accessibility

- The feed is the one `region` labelled "Shorts player" and takes focus when it opens. Up and Down arrows, `J` and `K` move between Shorts; Space plays and pauses; `M` mutes; `C` toggles captions; `L` likes. Each slide is a group named by its title; the ones off screen are `inert`.
- Actions are toggles with the count in the name; discussion opens a modal sheet with focus trap and return.
- A polite live region announces the new title and channel. Swipe is an enhancement: every gesture has a button. Autoplay respects the motion setting and starts muted.

## Extension points

- `className` on every part, merged with `cn`.
- `asChild` on `Action` and `Caption`.
- `useShortsPlayerFrame()` returns `{ state, layout, paused, playback }` for an app-local overlay.
- `tv({ extend: shortsPlayerFrameStyles, variants: { ... } })` for a local look.

## Smart wrappers

| Wrapper | Folder (`features/...`) | Props | Hooks |
|---|---|---|---|
| `ShortsFeed` | `shorts/components/` | `shorts`, `named`, `hasMore`, `loadMore`, `renderComments` | `useShortsScroll`, `useShortsPlayback`, `useShortsUrl`, `useReaction` |
| `ShortsSlide` | `shorts/components/` | `short`, `distance`, `layout`, `playback` | `useQuery(captionsQueryOptions)` |

`ShortsFeed` is the scroll-snap container (`snap-y snap-mandatory overscroll-contain touch-pan-y`): it reads which Short rests on screen, keeps the keys, and mirrors the Short into the URL with a replace once it rests. `ShortsSlide` mounts the Short on screen and the one beside it each side (paused, muted, `inert`, so a step finds the player built); the others hold their place. The playhead reaches only `ShortsFeedProgress` through the player channel, so the caption and the actions do not render with it. The actions are Like, Discussion, Share, Queue, Play next and Save (`ShortsFeedActions`); Subscribe is in the caption.

## Used by

[95](../../../tickets/95-design-system-2.md): the `/shorts` shell in web.

## Workbench stories

Ready with side actions; overlay at compact; paused; liked; loading and error; empty; last Short; RTL (column mirrors, arrows keep their meaning); skeleton.
