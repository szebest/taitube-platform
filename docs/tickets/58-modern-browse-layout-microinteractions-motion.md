# 58: Modern browse layout — responsive navigation, category pills & video card micro-interactions

| Field | Value |
|---|---|
| Phase | 5 — Developer experience & growth |
| Size | M |
| Blocked by | 54 — Frontend testing infrastructure · 55 — Modern design system |
| Blocks | 59, 62, 71, 74, 75 |
| Spec | [PRD §1 Summary](../PRD.md#1-summary) · [SDD §6.1 Endpoints](../SDD.md#61-endpoints) |

**Status:** blocked

## What to build

The home browse experience is the front door to Taitube. The original layout suffered from rigid Bootstrap grid alignment, cut-off titles, static image cards without video previews, and a clunky category filter.

This ticket redesigns the Browse & Feed experience:
1. **Collapsible Navigation & Sticky Header**:
   - YouTube-style responsive sidebar: Full expanded drawer on desktop (>1280px), compact icon-only rail on laptop (768px-1280px), and bottom navigation bar on mobile (<768px).
   - Primary sections:
     - **Main:** Home (`/`), Subscriptions (`/feed/subscriptions`), Trending (`/feed/trending`).
     - **You / Library:** History (`/feed/history`), Watch Later (`/playlist?list=watch-later`), Playlists (`/feed/playlists`), Your Videos (`/studio/videos`).
     - **General:** Settings (`/settings`), Report history, Help.
   - Centered search bar with quick shortcut (`/` to focus) and live auto-complete suggestion dropdown (Ticket 47).
2. **Dynamic Category Pill Bar**:
   - Horizontal scrolling chip list of active categories (`All`, `Gaming`, `Music`, `Tech`, etc.) populated from Ticket 37 API.
   - Smooth left/right chevron fade controls when scrolling overflow occurs.
   - Animated pill selection transition.
3. **Elevated Video Card Micro-Interactions**:
   - **Hover Video Preview:** When hovering over a video card for > 500ms, plays a silent, looping preview clip or rapid storyboard preview using the generated sprite sheet without navigating away.
   - **Video Metadata & Badges:** Clean display of duration badge (`12:45`), relative publication date (`"3 days ago"` via `Intl.RelativeTimeFormat`), view count, and channel avatar with hover channel card preview.
   - **Three-Dot Action Menu:** Accessible dropdown menu on each card: *"Save to Watch Later"*, *"Add to Playlist"*, *"Share"*, and *"Not Interested"*.

## Acceptance criteria

- [ ] Responsive navigation shell: full sidebar, mini rail, and mobile bottom bar transitions cleanly across breakpoints.
- [ ] Global search input with `/` hotkey focus listener, clear button, and live suggestions popup.
- [ ] Category pill bar with smooth horizontal drag/scroll and dynamic category fetching from backend.
- [ ] Video card component with duration badge, channel avatar, title truncation (max 2 lines with tooltip), and formatted views/time.
- [ ] Card hover preview: triggers silent preview playback or sprite animation after 500ms hover delay.
- [ ] Contextual 3-dot dropdown menu on each card using Radix DropdownMenu.
- [ ] Unit & visual regression tests for responsive breakpoints and card interactions.

## Out of scope

- Watch page layout (handled in ticket 61).

## Notes for the implementer

- Use `Intl.RelativeTimeFormat` and `Intl.NumberFormat` with `notation: 'compact'` for formatters (e.g. `1.2M views`, `2 days ago`) without bulky external libraries like moment.js.
- Ensure video card hover listeners clean up timers to prevent memory leaks when rapidly moving mouse across the grid.

## Testing plan

- Breakpoint test: Verify layout shifts between drawer, rail, and bottom bar at 768px and 1280px.
- Hover preview test: Simulate hover on card, assert preview video/sprite mounts after 500ms.

## Definition of Done

- [ ] `pnpm --filter @taitube/web test` passes.
- [ ] Fluid responsive layout verified on mobile, tablet, and wide desktop screens.
- [ ] Architecture and decision docs updated (`ARCHITECTURE.md`, `docs/SDD.md` and ADRs if boundaries, packages or contracts changed).
- [ ] Ticket status set to `done` and `python docs/tickets/gen-index.py` re-run.
