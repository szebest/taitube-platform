# 57: Production video player — YouTube-grade player (Vidstack, Ambient Glow, Storyboard Scrubbing, Cinema & Stats for Nerds)

| Field | Value |
|---|---|
| Phase | 5 — Developer experience & growth |
| Size | L |
| Blocked by | 53 — Frontend architecture · 54 — Frontend testing infrastructure · 55 — Modern design system |
| Blocks | 59, 62, 65, 73, 75, 76, 77, 78 |
| Spec | [SDD §7 Storage layout](../SDD.md#7-object-storage-layout) · [SDD §10 Real-time status SSE](../SDD.md#10-real-time-status-sse) |

**Status:** blocked

## What to build

A world-class video platform lives or dies by its player. The original frontend used a plain `react-player` wrapper that simply delegated to the default browser controls. 

This ticket delivers **Taitube Player (`<TaitubePlayer />`)** — an elite, fully-fledged video player built on **Vidstack (`@vidstack/react`)** and **HLS.js**, matching YouTube's exact ergonomics while carrying our own distinct brand feel (sleek obsidian dark theme, custom neon accent branding, and glassmorphic controls).

### 1. YouTube-Grade Visual Experience & "Taitube Feel"
- **Ambient Lighting Mode (Glow Effect):** A real-time ambient canvas that softly blurs and reflects the primary video colors onto the background behind the player, creating deep immersion (toggleable in settings).
- **Glassmorphic Floating Control Bar:** Smooth auto-hiding controls (fading out after 2.5s of inactivity) with a gradient backdrop shadow to ensure 100% visibility over bright video scenes.
- **Center Action Ripple Badges:** When pausing, playing, seeking, or changing volume, large animated icon badges ripple in the center of the video (just like YouTube's play/pause flash and double-tap ripples).
- **Double-Tap / Double-Click Seeking:** Double-clicking the left side seeks backward 10s with an animated `<< 10 seconds` chevron ripple; double-clicking the right side seeks forward 10s.

### 2. Timeline & Storyboard Scrubbing Preview
- **Floating Hover Thumbnail Preview:** When hovering anywhere along the seekbar, a floating tooltip displays the exact timestamp and a sharp preview frame parsed from the WebVTT sprite sheet (generated in backend Ticket 13).
- **Smooth Chapter Markers:** Timeline segments show chapter visual breaks with hover title tooltips if chapter metadata is present.
- **Scrubbing Time Indicator:** Shows current time / total duration with relative countdown toggle on click.

### 3. Adaptive Bitrate (ABR) & Stream Quality Selector
- **Multi-variant HLS Engine:** Automatic ladder selection (1080p, 720p, 480p) driven by bandwidth estimates and buffer health.
- **Settings Gear Menu:**
  - Quality selection: `Auto` with current badge (e.g. `Auto (1080p)`), `1080p HD`, `720p`, `480p`.
  - Playback speed: `0.25x`, `0.5x`, `0.75x`, `Normal (1x)`, `1.25x`, `1.5x`, `1.75x`, `2x`.
  - Ambient mode toggle (On / Off).
  - Annotations / Captions toggle.

### 4. Layout Modes & Picture-in-Picture
- **Theater / Cinema Mode (`t`):** Expands the player to span the full browser viewport width while keeping the header and page scrollable.
- **Fullscreen (`f` / double-click):** Native browser fullscreen with customized control layout.
- **Picture-in-Picture (PiP / `i`):** Native Picture-in-Picture window for multitasking.
- **Miniplayer on Scroll:** Automatically detaches into a compact floating player in the bottom-right corner when scrolling down to read long comment threads.

### 5. Advanced Power-User Features: "Stats for Nerds"
- Right-click context menu opens a custom Taitube context menu:
  - Copy video URL
  - Copy video URL at current time
  - Copy embed code
  - **"Stats for Nerds" Overlay:** Displays real-time live diagnostics: current resolution, viewport size, frame drops, network activity, audio/video codecs, buffer health in seconds, and playback latency.

### 6. YouTube Keyboard Navigation Matrix
- `Space` / `k`: Play / Pause toggle
- `j` / `l`: Seek -10s / +10s
- `Left` / `Right`: Seek -5s / +5s
- `Up` / `Down`: Volume +/- 5% (with logarithmic audio perception curve)
- `m`: Mute / Unmute
- `t`: Theater mode toggle
- `f`: Fullscreen toggle
- `i`: Miniplayer / PiP toggle
- `,` / `.`: Frame-by-frame backward / forward when paused
- `0`–`9`: Seek to 0% – 90% of duration

## Acceptance criteria

- [ ] `@vidstack/react` and `@vidstack/react/player/styles/default/theme.css` integrated into `apps/web/src/components/player/`.
- [ ] Custom Tailwind CSS skin applied giving a unified Taitube design language (obsidian controls, violet/amber accent seekbar, glassmorphic menus).
- [ ] Real-time Ambient Mode implemented via `<canvas>` or CSS background filter reflecting video edges onto the backdrop with 60 FPS performance and low CPU overhead.
- [ ] WebVTT sprite sheet thumbnail preview tooltip rendered on seekbar hover.
- [ ] Double-click / double-tap seeking (left: -10s, right: +10s) with animated chevron ripple badges.
- [ ] Center play/pause flash animation on state change.
- [ ] Settings gear menu with Quality picker, Playback speed, and Ambient toggle.
- [ ] Theater mode (`t`) layout shift and Picture-in-Picture (`i`) operational.
- [ ] Custom context menu on right click with "Stats for Nerds" modal displaying live buffer, dropped frames, and HLS bandwidth.
- [ ] Full YouTube keyboard shortcuts functional and automatically suspended when focused on form inputs.
- [ ] User preferences (volume, muted, ambient mode, quality) saved to `localStorage`.
- [ ] Heartbeat ping sent to `POST /v1/videos/:id/views` and progress saved to `POST /v1/me/history`.
- [ ] Unit & visual tests verifying player lifecycle, shortcut triggers, and unmount cleanup.

## Out of scope

- DRM licensing (FairPlay / Widevine).
- Client-side video trimming / clipping UI.

## Notes for the implementer

- **Ambient Mode Performance:** Use an offscreen canvas sampled at 10–15 FPS downscaled to 32x18 pixels and blurred with `filter: blur(40px)`. This yields identical visual ambient glow to YouTube with near-zero CPU/GPU utilization.
- **Logarithmic Volume:** Humans perceive loudness logarithmically; map linear volume slider `v` (0 to 1) to `Math.pow(v, 2)` before applying to the HTML audio element.

## Testing plan

- Ambient performance test: Profile memory and frame rate with ambient glow enabled on 1080p stream; assert zero frame drops.
- Keyboard matrix test: Trigger each shortcut via testing library and verify expected video state.
- Scrubbing test: Move mouse across seekbar and assert preview thumbnail frame coordinates match timestamp.

## Definition of Done

- [ ] All ACs green under `pnpm --filter @taitube/web test`.
- [ ] Player verified in Chrome, Firefox, Edge, and Safari.
- [ ] Architecture and decision docs updated (`ARCHITECTURE.md`, `docs/SDD.md` and ADRs if boundaries, packages or contracts changed).
- [ ] Ticket status set to `done` and `python docs/tickets/gen-index.py` re-run.

