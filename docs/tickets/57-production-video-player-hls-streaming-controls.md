# 57: Production video player — YouTube-grade player (Vidstack, Ambient Glow, Storyboard Scrubbing, Cinema & Stats for Nerds)

| Field | Value |
|---|---|
| Phase | 5 — Developer experience & growth |
| Issue | [#57](https://github.com/szebest/taitube-platform/issues/57) |
| Size | L |
| Blocked by | 55 - Design system · 75 - Playwright harness · 89 - TanStack Start foundation · 91 - Web import aliases · 93 - Creator Studio as its own app |
| Blocks | 59, 62, 65, 66, 73, 76, 77, 78, 102, 105 |
| Spec | [SDD §7 Storage layout](../SDD.md#7-object-storage-layout) · [SDD §10 Real-time status SSE](../SDD.md#10-real-time-status-sse) |

**Status:** ready

> **Coordination with [95](95-design-system-2.md).** The merged slices stay. The remaining slices (the skin and
> everything after it) start once 95's slices 1 to 6 are merged and build on them: the player chrome takes
> the role tokens (`scrim` under controls and text on video, `media` behind the video, `accent` for progress),
> the seekbar and volume are the `Slider` primitive, the settings and context menus are `DropdownMenu` and
> `ContextMenu`, and the default chrome is the quiet player from
> [docs/design/README.md section 1](../design/README.md#1-who-taitube-is): play, time, volume, chapters,
> theater and fullscreen, with quality, speed and stats in the settings and context menus. Every control
> state is a story in `@vp/workbench` with visual baselines.

> **Builds on 89.** The legacy watch page (`src/modules/VideoPage`, carried over by
> [89](89-web-tanstack-start-foundation.md) on `/watch/$videoId`) plays through a `react-player` wrapper with the
> browser's default controls. This ticket swaps that wrapper for the new player inside the legacy page, so
> playback improves before [59](59-video-watch-page-responsive-layout-enhancements.md) redesigns the page. It
> owns removing `react-player` from `apps/client/web/package.json` once the legacy page no longer imports it; the rest
> of `src/modules/VideoPage` is 59's to delete.

## What to build

`<TaitubePlayer />` in `apps/client/web/src/features/player/`, built on Vidstack (`@vidstack/react`) with hls.js,
skinned with the Tailwind tokens and Radix primitives from [55](55-design-system-tailwind-radix-dark-theme.md).
It takes a video resource from `@vp/api-contracts` (`playbackUrl`, `posterUrl`, `spriteVttUrl`) and knows
nothing about routes or data fetching.

### 1. Playback and ABR

- The multi-variant HLS master from `playbackUrl`, automatic rendition selection by bandwidth and buffer.
- Settings menu: quality (`Auto (1080p)` badge, then each rendition in the master), playback speed
  (0.25x to 2x), ambient mode toggle, captions toggle when tracks exist.
- Preferences (volume, muted, speed, quality, ambient) persist per browser in a small typed `localStorage`
  store wrapped in try/catch; [72](72-frontend-settings-customization-system.md) later moves the defaults into
  the settings store.

### 2. Controls and feel

- Auto-hiding control bar (2.5 s of inactivity) over a gradient so it reads on bright frames.
- Centre badges on play, pause, seek and volume change; double-click or double-tap on the left or right third
  seeks 10 s back or forward with a chevron ripple.
- Seekbar hover preview: timestamp plus the frame from the WebVTT sprite sheet that
  [13](13-thumbnails-flow-child.md) generates (`spriteVttUrl`).
- Ambient mode: a downscaled canvas sampled at 10 to 15 FPS, blurred behind the player.

### 3. Layout modes

- Theater mode (`t`) as a player state the watch page reads to change its layout; fullscreen (`f`, double-click);
  native Picture-in-Picture (`i`).
- No miniplayer: leaving the watch page keeps the video playing in 95's `NowPlayingBar`
  ([73](73-frontend-youtube-playlists-library-player-queue.md) owns that playback); the player exposes a
  compact variant for it.

### 4. Power-user features

- Custom context menu: copy URL, copy URL at the current time (`?t=`), copy embed code.
- Stats for nerds overlay: resolution, viewport, dropped frames, bandwidth estimate, codecs, buffer health.

### 5. Keyboard

`Space`/`k` play-pause, `j`/`l` -10/+10 s, arrows -5/+5 s and volume, `m` mute, `t` theater, `f` fullscreen,
`i` PiP, `,`/`.` frame step when paused, `0` to `9` seek to 0 to 90 %. Shortcuts are suspended while focus is in
an input, textarea or contenteditable.

### 6. SSR

The player is client-only. The watch route renders the poster image with the right aspect ratio on the server
(no layout shift, the poster is the LCP candidate), and mounts `<TaitubePlayer />` after hydration through a
lazy client boundary, not a route-wide `ssr: false`.

### 7. Events for other tickets

The player emits typed `onTimeUpdate`, `onEnded` and `onQualityChange` callbacks. It sends nothing itself: the
views heartbeat and QoS beacons are [65](65-first-party-video-playback-telemetry-analytics-beacon.md) (a tracker
in `features/player/`), resume progress is [73](73-frontend-youtube-playlists-library-player-queue.md).

## Delivery slices

1. `<TaitubePlayer />` with Vidstack + hls.js, default skin, poster SSR, swapped into the legacy watch page;
   `react-player` removed.
2. Taitube skin, settings menu (quality, speed), persisted preferences, keyboard matrix.
3. Seekbar sprite preview, centre badges, double-tap seek.
4. Theater and PiP modes, compact variant.
5. Context menu, stats for nerds, ambient mode.

## Acceptance criteria

- [ ] `<TaitubePlayer />` lives in `apps/client/web/src/features/player/` and plays a READY video's HLS master in the
      legacy watch page; `react-player` is gone from `apps/client/web/package.json`.
- [ ] Server-rendered `/watch/<id>` HTML contains the poster image with fixed aspect ratio; the player mounts
      only in the browser.
- [ ] Quality menu lists the renditions from the master plus `Auto`, and switching changes the active level.
- [ ] Speed, volume, muted, quality and ambient preferences survive a reload; a throwing `localStorage` does
      not break playback.
- [ ] Seekbar hover shows the sprite frame for the hovered time from `spriteVttUrl`, and nothing when the
      video has no sprite.
- [ ] Double-click or double-tap seeking with ripple badges; centre badge on play and pause.
- [ ] Theater (`t`) and PiP (`i`) work; theater state is readable by the page.
- [ ] Context menu with the copy actions and the stats for nerds overlay showing live buffer, dropped frames
      and bandwidth.
- [ ] Every shortcut in the matrix works and none fires while an input has focus.
- [ ] `onTimeUpdate`, `onEnded` and `onQualityChange` fire with typed payloads.
- [ ] Meets the polish bar ([docs/design/README.md section 9](../design/README.md#9-the-polish-bar)) on every
      surface this ticket builds.
- [ ] The default control bar shows only play, time, volume, chapters (when passed), theater and fullscreen;
      quality, speed and stats for nerds are reachable from the settings menu and the context menu.
- [ ] The seekbar and volume are `Slider`s: arrow keys step 5 s and 5 %, and the seekbar's `aria-valuetext`
      reads the current time and duration.
- [ ] Every control state (paused, playing, buffering, muted, menu open, theater, fullscreen, error) has a
      story in `@vp/workbench` with visual baselines; the chrome holds no hex value and no colour outside
      `scrim`, `media`, `fg` and `accent`.
- [ ] Unmount destroys the hls.js instance and removes every listener and timer (spec asserts it).
- [ ] A playback flow in the Playwright suite from [75](75-fullstack-e2e-playwright-security-perf-validation.md):
      the `<video>` element fires `playing` and `timeupdate` on the HLS master of a seeded READY video, with
      no off-machine request.

## Out of scope

- DRM (FairPlay, Widevine).
- Client-side trimming or clipping.
- Chapter data: no backend source; [59](59-video-watch-page-responsive-layout-enhancements.md) derives
  chapters from description timestamps and passes them in.
- Views heartbeat and history progress: 65 and 73.

## Notes for the implementer

- Ambient mode: sample to a 32x18 offscreen canvas and scale it up with `filter: blur(40px)`; this keeps CPU
  near zero.
- Volume: map the linear slider `v` to `v ** 2` before applying it, loudness is perceived logarithmically.

## Testing plan

- Keyboard matrix as one `it.each` over key and expected player state.
- Sprite preview: parse a fixture VTT, hover at a time, assert the background position of the matching cue.
- Lifecycle: mount, unmount, assert hls.js `destroy` and no live listeners.
- SSR: server-render the watch route, assert the poster and no player markup.

## Definition of Done

- [ ] `pnpm --filter @vp/web test` and `pnpm typecheck` pass.
- [ ] Player verified in Chrome, Firefox, Edge and Safari.
- [ ] Architecture and decision docs updated (`ARCHITECTURE.md`, `docs/SDD.md` and ADRs if boundaries, packages or contracts changed).
- [ ] Ticket status set to `done` and `python3 docs/tickets/gen-index.py` re-run.
