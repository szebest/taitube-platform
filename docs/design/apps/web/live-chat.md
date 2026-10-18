# LiveChat

Location: `apps/client/web/src/components/live/live-chat/`. Web's app kit, presentational and compound, built from `ScrollArea`, `Textarea`, `Slider` and `Avatar`.

Chat docked to the right of a live stream, or overlaid on the video in fullscreen and on a vertical stream, with an opacity slider. The live pulse and badge belong to the stage; red is the live role and nothing else.

## Anatomy

```
┌───────────────────────────────┬─────────────────────┐
│                               │ 1 Live chat   [2 ⋮]  │
│        player                 ├─────────────────────┤
│                               │ ◯ ines  The tram!    │ 3
│          [LIVE] 4             │ ◯ lis   [pinned] 5   │
│                               ├─────────────────────┤
│                               │ 6 [ Say something ][>]│
└───────────────────────────────┴─────────────────────┘
```

| # | Part | Notes |
|---|---|---|
| 1 | `Header` | `label`, viewer count in `mono` |
| 2 | menu | overlay opacity slider, text size, hide chat |
| 3 | `List` of `Message` | `avatar.sm`, name in `label`, text in `body-sm`, newest at the bottom |
| 4 | live badge | from the [Stage](stage.md), shown for context |
| 5 | `Pinned` | a `surface` bar above the list |
| 6 | `Composer` | one-row `Textarea` and a send `IconButton`; a counter at 80 % of the limit |

## Props

```ts
// types.ts
export type LiveChatLayout = 'docked' | 'overlay';
export type LiveChatRole = 'viewer' | 'creator' | 'moderator';
export type LiveChatMessageState = 'sent' | 'pending' | 'failed' | 'removed';
```

```ts
interface LiveChatRootProps {
  layout?: LiveChatLayout;
  onSend: (text: string) => void;
  onEndReached?: () => void;
}

interface LiveChatMessageProps {
  author: string;
  avatarSrc?: string;
  role?: LiveChatRole;
  state?: LiveChatMessageState;
}
```

The `overlay` layout adds `LiveChat.Opacity` (a `Slider`) to the header menu; the pattern keeps its value. Placeholder, "Jump to latest" and the slider label come from `useUiCopy()`. Transport (SSE or socket, rate limiting) is the wrapper's ([76](../../../tickets/76-live-streaming-rtmp-whip-llhls-packaging-chat.md)).

## Variants

| Layout | Difference |
|---|---|
| `docked` | 340 px column, `surface`, `border.divider`, at the player's full height |
| `overlay` | over the video at the inline end, 360 px at 85 % opacity by default (the slider sets 30 to 100 %), text on `scrim`, the composer only on hover or focus, pointer events pass through the gaps |

## States

| State | What changes |
|---|---|
| live | messages append, the list sticks to the bottom |
| scrolled up | auto-follow pauses; "Jump to latest" appears with the unread count |
| pending, failed | 70 % opacity; `danger-ink` marker with Retry |
| removed | text replaced by a `fg-muted` line |
| slow mode | the composer shows a countdown and disables |
| disconnected | an [OfflineState](offline-state.md) `banner`, composer disabled |
| chat off, ended | an [EmptyState](../../components/empty-state.md) `inline` line; "Chat ended" in place of the composer |

## Responsive behaviour

Compact: below the player in portrait (40 vh, the page scrolls), overlay in landscape and fullscreen. Medium: docked, 300 px. Expanded: 340 px. Large: 380 px; theater puts it under the stage.

## Skeleton

`LiveChatSkeleton`: panel 340 px wide by the player's height, eight message rows 36 px high each with an `avatar.sm` circle and a bar 40 to 90 % wide. Rules in [skeletons](../../components/skeletons.md).

## Motion

Following, messages append unanimated; scrolled up, nothing moves. "Jump to latest" scrolls at `base` with `settle`. Overlay opacity follows the slider with no easing. The live pulse is the stage's and stays under reduced motion.

## Accessibility

- The list is `role="log"` with `aria-live="off"`; a menu toggle turns on `polite`, throttled to one announcement per three seconds.
- Enter sends, Shift Enter breaks a line, Escape leaves the field. Roles are text badges, not colour alone.
- The slider is keyboard operable. A skip link reaches the chat from the player.

## Extension points

- `className` on every part, merged with `cn`.
- `asChild` on `Message` (author link) and `Header`.
- `useLiveChat()` returns `{ layout, following, jumpToLatest }` for an app-local part such as a donation row.
- `tv({ extend: liveChatStyles, variants: { ... } })` for a local look.

## Smart wrappers

| Wrapper | Folder (`features/...`) | Props | Hooks |
|---|---|---|---|
| `LiveStreamChat` | `live/components/` | `streamId: string` | `useLiveChat(streamId)` (transport, send, rate limit), `usePlayerLayout` (fullscreen, vertical), `useCan`, `useFormat`, `useT` |

It chooses `layout` from the player layout and maps the transport's message states to `LiveChatMessageState`.

## Used by

[76](../../../tickets/76-live-streaming-rtmp-whip-llhls-packaging-chat.md) the chat; [95](../../../tickets/95-design-system-2.md) the `/live` shell with the docked slot and the overlay layout.

## Workbench stories

Docked with ten messages; pinned; overlay at 60 %; scrolled up; pending and failed; slow mode; disconnected; creator and moderator roles; compact portrait; RTL; skeleton.
