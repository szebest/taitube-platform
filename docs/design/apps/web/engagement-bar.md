# EngagementBar

Location: `apps/client/web/src/components/watch/engagement-bar/`. Web's app kit, presentational and compound, built from `Avatar`, `Button`, `ToggleGroup` and `DropdownMenu`.

The row under the watch page title: the channel, subscribe, the reaction segment and the actions. Every action is the same pill height and only the viewer's own state (liked, followed, saved) takes the accent.

## Anatomy

```
 ┌────┐ 1 Marta Reis Films        2 [Subscribe]     3 [ Like 24K | Dislike ]  4 [Share] [Save] [Queue] [Clip] [5 ...]
 │ av │   284K subscribers
 └────┘
```

| # | Part | Notes |
|---|---|---|
| 1 | `Channel` | `Avatar` at `avatar.lg`, name in `title`, count in `body-sm` `fg-muted`; a link slot |
| 2 | `Subscribe` | `Button`: unsubscribed primary, subscribed secondary with a check and a notifications menu |
| 3 | `Reaction` | two joined buttons on `tint`, radius `chip`, `border.divider` between; like carries the count |
| 4 | `Action` | pills `control.md` high on `tint`: Share, Save, Queue, Clip |
| 5 | overflow | `DropdownMenu` taking the actions that do not fit, in reverse order |

## Props

```ts
// types.ts
import type { ReactionType } from '@vp/domain';

export type EngagementBarLayout = 'bar' | 'stacked';
export type EngagementBarReaction = ReactionType | null;
```

```ts
interface EngagementBarRootProps {
  layout?: EngagementBarLayout;
}

interface EngagementBarSubscribeProps {
  subscribed: boolean;
  pending?: boolean;
  onToggle: () => void;
}

interface EngagementBarReactionProps {
  value: EngagementBarReaction;
  likes: string;
  onChange: (next: EngagementBarReaction) => void;
}
```

An action that is not a child is not shown (Save arrives with [73](../../../tickets/73-frontend-youtube-playlists-library-player-queue.md)). `layout` follows the breakpoint when omitted. Labels (Subscribe, Like) are children the wrapper supplies; the count is a finished string.

## Variants

| Layout | Difference |
|---|---|
| `bar` | one row on expanded and up |
| `stacked` | channel and Subscribe first, reaction and actions on a second scrolling row |

## States

| State | What changes |
|---|---|
| subscribed | `Subscribed`, secondary with a check, `aria-pressed="true"` |
| liked or disliked | that half takes `accent-soft` ground and `accent-ink` icon; the count updates optimistically |
| pending | keeps its new look with a `Spinner` at `icon.sm`; reverts on failure and the wrapper raises a `Toast` |
| saved | Save takes `accent-soft` and `accent-ink` |
| signed out | buttons stay enabled and open sign-in through the callback; no disabled look |

## Responsive behaviour

Compact: `stacked`, icon-only pills `layout.touch-target` square with tooltips and `aria-label`, the row scrolls with an edge fade. Medium: `stacked`, labelled. Expanded: `bar`; Clip and Queue fold into overflow under 720 px. Large: all visible.

## Skeleton

`EngagementBarSkeleton`: avatar `avatar.lg` circle, bars 140 by 22 and 96 by 20, subscribe pill 120 by `control.md`, reaction segment 188 by `control.md`, three action pills 96 by `control.md`, 8 px gap. Rules in [skeletons](../../components/skeletons.md).

## Motion

Press: `tint-strong` at `instant`. The like count rolls a 4 px slide and fade at `fast` with `settle`. The subscribe label crossfades at `fast`. Reduced motion: no roll, instant swap.

## Accessibility

- `role="toolbar"` with a label; arrows move between actions; Subscribe and the channel link sit outside it.
- Like and dislike are toggles with `aria-pressed`; the count is in the name ("Like, 24 thousand"). Subscribe is a toggle announced by a polite live region.
- Icons are `aria-hidden`; every icon-only state keeps a text label. The overflow menu follows the menu pattern.

## Extension points

- `className` on every part, merged with `cn`.
- `asChild` on `Channel` (a router `Link`) and `Action`.
- `useEngagementBar()` returns `{ layout }`, so an app-local action reads the same layout.
- `tv({ extend: engagementBarStyles, variants: { ... } })` for a local look.

## Smart wrappers

| Wrapper | Folder (`features/...`) | Props | Hooks |
|---|---|---|---|
| `WatchEngagementBar` | `watch/components/` | `video: Video` | `useSubscription(channelId)`, `useReaction(videoId)`, `useVideoActions`, `useShare`, `useCan`, `useFormat`, `useT` |

It fixes the actions to Share, Save, Queue and Clip, links `Channel` to the channel route, and sends a signed-out viewer to sign-in from every callback.

## Used by

[59](../../../tickets/59-video-watch-page-responsive-layout-enhancements.md) channel, subscribe, reactions, share; [73](../../../tickets/73-frontend-youtube-playlists-library-player-queue.md) adds Save.

## Workbench stories

Signed in, not subscribed; subscribed and liked; disliked; pending subscribe and reaction; verified long name; 1.2M counts; stacked icon-only; overflow open; signed out; RTL; skeleton.
