# NowPlayingBar

Location: `apps/client/web/src/components/shell/now-playing-bar/`. Web's app kit, presentational and compound, built from `@vp/ui` primitives.

A bar along the bottom of the content column that keeps the video playing when the viewer leaves the watch page. It carries the "Now playing bar" signature move: Taitube has no corner miniplayer.

## Anatomy

```
┌────────────────────────────────────────────────────────────────────────────┐
│ ┌────────┐  1 Shot entirely on a 1998 camcorder: Lisbon at night           │
│ │ 2 live │    Marta Reis Films · 3 / 12 in queue                           │
│ │ picture│  [|<] [> 3] [>|]   ───●────────────  04:12 / 18:42   [Q 4] [^ 5] [x]│
│ └────────┘  6 progress, flush to the top edge                              │
└────────────────────────────────────────────────────────────────────────────┘
```

| # | Part | Notes |
|---|---|---|
| 1 | `Info` | title in `label`, one line; channel and queue position in `body-sm` `fg-muted` |
| 2 | `Media` | the playing video at 16:9, 128 px wide (88 px on compact), radius `sm`; the wrapper supplies the media element |
| 3 | `Previous`, `PlayPause`, `Next` | `IconButton`s at `control.md` |
| 4 | `Queue` | opens the queue, shows the count |
| 5 | `Expand` | returns to the watch page at the current time |
| 6 | Progress | 2 px `Progress` in `accent` flush to the top edge, a 12 px hit area for seeking on pointer devices |

## Props

```ts
// types.ts
export type NowPlayingBarStatus = 'ready' | 'buffering' | 'live' | 'unavailable';
```

```ts
interface NowPlayingBarRootProps {
  playing: boolean;
  progress: number;
  onPlayPause: () => void;
  onSeek: (fraction: number) => void;
}

interface NowPlayingBarInfoProps {
  title: string;
  subtitle?: string;
  time?: string;
  status?: NowPlayingBarStatus;
}
```

Previous, next and queue exist only when their part is a child. Playback is the app's ([73](../../../tickets/73-frontend-youtube-playlists-library-player-queue.md)); `Media` receives the live element. Transport labels come from `useUiCopy()`. The layout follows the breakpoint: `compact` has an 88 px picture, no previous, and the queue count folded into the queue button.

## States

| State | What changes |
|---|---|
| playing, paused | pause or play icon; progress animates or rests |
| buffering | `Spinner` over the picture |
| live | `live` `Badge` replaces the time, no seek |
| no next or previous | button disabled and out of the tab order |
| unavailable | title in `fg-muted`, play replaced by a retry button, bar stays so the viewer can skip |
| hidden | nothing renders without media |

Elevation `elevation-3`, ground `surface`, radius `card`.

## Responsive behaviour

| Breakpoint | Behaviour |
|---|---|
| compact | fixed 72 px above the tab bar (`layout.touch-target` plus its height), inset 8 px, play and next only |
| medium | content column, inset `gap-stack`, full transport |
| expanded, large | as medium, with the time label |

The shell pads `Main` by the bar's height.

## Skeleton

None: the bar appears only with media, so there is no loading layout.

## Motion

Enter: slides up 16 px and fades, `base` with `enter`; exit fades with `exit`. The picture's hand-over from the [Stage](stage.md) is the shared element (same name as the card's, from the video id) at `cinematic`. Progress follows the media clock, unanimated. Reduced motion: opacity only, the hand-over is a cut.

## Accessibility

- `role="region"` labelled "Now playing", not a live region; a hidden polite element announces the new title on track change.
- Play and pause is one button with a switching label. Progress is a `role="slider"` with `aria-valuetext`; arrows seek 5 s.
- Tab order: expand, previous, play, next, seek, queue. The media element is `aria-hidden`.

## Extension points

- `className` on every part, merged with `cn`.
- `asChild` on `Expand` (a router `Link`) and `Info`.
- `useNowPlayingBar()` returns `{ playing, progress, status }` for an app-local part such as a sleep timer.
- `tv({ extend: nowPlayingBarStyles, variants: { ... } })` for a local look.

## Smart wrappers

| Wrapper | Folder (`features/...`) | Props | Hooks |
|---|---|---|---|
| `GlobalNowPlayingBar` | `watch/components/` | none | `usePlayback` (element, playing, progress, seek), `usePlaybackQueue`, `useFormat`, `useT` |

It renders nothing without a loaded video, fixes `Expand` to the watch route with the current time, and opens the queue through `useWatchQueueSheet()`.

## Used by

[73](../../../tickets/73-frontend-youtube-playlists-library-player-queue.md) owns the playback behind it; [59](../../../tickets/59-video-watch-page-responsive-layout-enhancements.md) hands playback over; [58](../../../tickets/58-modern-browse-layout-microinteractions-motion.md) mounts the slot.

## Workbench stories

Playing with queue position; paused; buffering; live; last in queue; unavailable; compact above the tab bar; long title; RTL (transport does not mirror).
