# 136: Front-end UI and feel overhaul, web and studio - layers, tokens, motion, sign-in prompt, settings, queue, mini player, shorts and the local demo login

| Field | Value |
|---|---|
| Phase | 5 - Developer experience & growth |
| Size | XL (4 stacks, 12 slices) |
| Blocked by | 68 - PWA and service worker - 73 - Playlists and library - 102 - Shorts - 131 - Front-end folder structure (which waits on 110 - Oxc and Vite+) |
| Blocks | — |
| Spec | [95 design system 2](95-design-system-2.md) - [design foundations, motion](../design/foundations/motion.md) - [72 settings](72-frontend-settings-customization-system.md) - [97 account preferences](97-account-preferences-api.md) - [57 player](57-production-video-player-hls-streaming-controls.md) - [docs/standards/authorization.md](../standards/authorization.md) |

**Status:** blocked

> **Why.** The owner clicked through the running app and found the same classes of defect on every page: the page
> jumps when an overlay opens or closes, chrome text is selectable, tab bars lock up or lose their counts, a modal
> vanishes with no exit animation, a guest's click does a different thing on each surface (a redirect here, a legacy
> toast there, nothing at all in Shorts), three Subscribe buttons and two avatar looks exist, the player's controls
> vanish on a light theme, the queue is hard to find and hard to fill, and Shorts has no seek bar and shares a
> `/watch` link. The creator studio was never clicked through, and its login does not work in a production build.
> This ticket takes the whole list as one planned pass: one root fix per class, a mechanical check where a check
> can hold it, and a before and after number for every change that claims to be faster.
>
> **Order against 131 and 110, decided.** 136 waits. [131](131-frontend-folder-structure-names-and-boundaries.md)
> moves nearly every client file (`git mv` of 208 web and 65 studio files, `__stories__/` folders, new `lib/` and
> `hooks/` homes), and it waits on [110](110-oxc-vite-plus-toolchain.md), which reformats the repo. A UI pass
> written first would conflict with every one of those moves, and 131's acceptance is "no baseline updated, no
> spec assertion changed", which a UI pass breaks by design. So the order is 110, then 131, then this ticket, and
> every path below is written for the tree 131 leaves (`components/<area>/<name>/`, `features/<domain>/`,
> `lib/`, `integrations/`). Slice a1 re-surveys the tree before it edits anything. The one piece that does not need
> to wait is the local demo login (slice a1): see Open questions.

## Today (main fdf3f439, 2026-10-31)

Measured by launching the app and clicking: the demo stack (production build of main, web :5173, studio :5174) and
a Vite dev server for each (:5183, :5184), Chrome through chrome-devtools-axi, signed in with `demo/login.sh`.
"Code" means read from the source and not yet seen in a browser; each is marked.

### What exists already (reuse it, build nothing twice)

| Need | What main has |
|---|---|
| z layers | `scale.z` in `docs/design/tokens.json`: base 0, sticky 20, rail 30, overlay 40, modal 50, popover 60, toast 70, tooltip 80, generated as `--z-*` and Tailwind `z-*` (`sets.css:17-24`). No lint or architecture test holds it; `zero-matches-design-rows.ts:77` bans only `var(--z-index-*)` |
| Contrast test | `checkThemeContrast` and `REQUIRED_PAIRS` (`design-tokens/src/roles.ts:55`), run for both themes by `themes.test.ts:28`. It passes, and misses the pairs under "Contrast" below |
| Appearance fields | all of them: `radius` (sharp, soft, round), `spacing` and `sizing` (density), `motion` (standard, calm, reduced), `contrast` (standard, more), `fontSize` (small, default, large, xlarge). No schema change is needed to offer them |
| Settings area | `/settings`, `/appearance`, `/appearance/advanced`, `/accessibility`, `/playback`, `/privacy`, `/notifications`, `/language`, 33 rows (`settings-index.ts:59`). None sits under `_authed`, so every device section already works logged out |
| Account sync | `GET` and `PATCH /v1/me/preferences` (97) with `version` and 409 on conflict; `PreferencesSync` debounces 400 ms; `merge-account.ts:34` merges on sign-in |
| Hover | `hoverPreview` playback flag (default true) read only in `feed-video-card.tsx:26` as `expandOnHover`; `VideoCard.Expanded` (500 ms rest, mouse only, grid and shelf variants, absolutely positioned, shifts no neighbour); `VideoCard.Thumb` accepts `previewSrc` and renders a muted looping `<video>` (autoplay off under reduced motion), and nobody passes it |
| Queue | `QueueModes`, a drag handle with keyboard reorder (Space, arrows, Space; Enter selects; Delete removes), a remove button, a Drawer under the medium breakpoint (`queue.tsx:233,256`). `enqueue` is declared in `use-video-actions.ts:8` and never returned |
| Mini player parts | `NowPlayingBar` and the `AppShell.NowPlaying` slot exist; `RootShell` mounts neither |
| Overlay primitives | one library, `radix-ui` ^1.7.0 (Command is cmdk, Drawer is Radix Dialog); `ResponsiveModal` exists in `@vp/ui` and 2 sites use it |
| Toast | `Toast` in `@vp/ui` with one action and 8 s lifetime with an action, at most 3; the web root also mounts `react-toastify` (`__root.tsx:89`) |
| Authorization | CASL in `@vp/permissions` with guest rules, `useCan` and `<Can fallback>` in `@vp/permissions-react`; the url-modal registry (`features/url-modal/registry.ts`) and save-to-playlist already open a modal for an action |
| Vitals | `@vp/web-telemetry` measures LCP, CLS, FCP, TTFB and INP and beacons them; it records no long task and no layout-shift source |

### Problems, with the reproduction and the cause

**1. Layout shift when an overlay opens or closes.**
Locks body scroll (Radix through `react-remove-scroll-bar` 2.3.8, which sets `data-scroll-locked`,
`overflow:hidden !important`, `position:relative !important` and `margin-right: <scrollbar width> !important`):
Dialog, AlertDialog, Drawer, ResponsiveModal, Select (always), DropdownMenu and ContextMenu (`modal` defaults to true,
no call site overrides it). Does not lock: Popover, Tooltip, HoverCard, Toast.
Measured on web at 1280, 768 and 500: 0 px width shift, because `html` has `scrollbar-gutter: stable` and the
body stays 1265 px wide. Two defects remain. (a) **A scroll jump on close**: scroll the page to 700, open the share
dialog, close it, and `scrollTop` is 219. (b) The only `scrollbar-gutter` rule is `apps/client/web/src/index.scss:13-17`,
`html:not(:has(body .modal)){scrollbar-gutter:stable}`: `.modal` is the Bootstrap class, so a Radix overlay never
switches it off, and where the scrollbar takes space (Windows, Linux, macOS with "always show scroll bars") the library's
margin narrows the body a second time (code, not seen on this macOS overlay-scrollbar machine). Studio has no gutter
rule at all, so its fixed elements jump by the scrollbar width on every lock (code). The owner sees a jump; the
test must therefore run with a classic scrollbar (`--hide-scrollbars` off, an emulated 15 px scrollbar), not only on
macOS.

**2. Selectable chrome.**
9 `select-none` uses, all in `@vp/ui` (panel, tooltip, label, dropdown-menu, slider, button, scroll-area, avatar,
command); none in the apps or `@vp/components`, and no raw `user-select`. 30 of 39 primitive folders have none: kbd,
badge, chip, tabs, segmented-control, toggle-group, checkbox, switch, the select trigger, the interactive card, the app
shell links and tab bar. Measured with `getComputedStyle`: the "/" hint (`<Kbd aria-hidden>` inside the search trigger,
`app-shell-header.tsx:74`), the search trigger label, 14 of 14 sidebar items, the account trigger, 26 of 26
duration badges and 28 of 28 thumbnails are selectable. All main buttons are `none`.

**3. Z-index.**
50 sites: 26 use the tokens, 24 are raw (8 `z-0`/`z-1`, 7 `z-[1..4]` in the shorts frame, 6 negative glows, 3
legacy), plus 7 `isolate` contexts. Conflicts: seven things share `z-sticky` (header, chip bar, page header, tab bar,
now-playing bar, mobile stage, table head) and DOM order decides; the studio upload widget and the toast viewport are
both 70; `react-toastify` is 9999 (above dialog and tooltip); the Bootstrap dropdown is 1000 (`video-settings-dropdown.tsx`);
the legacy `VideoCard` sets inline `zIndex = N - index`, which can pass the header on a long list (code). Measured: the
header (20), dialogs (50) and menus (60) paint in the right order, so no live stacking defect was found, only the
rules that would break one.

**4. Speed.**
Production path, the click path home, video, back, search, sidebar, theme: CLS 0.095 (one 0.094 shift on the home
load, from the install banner and the hero mounting), 2 long tasks totalling 128 ms, and each keystroke in the "/"
search palette costs about 216 ms (INP about 216). React commits are unreachable in a production build (no devtools
hook). Code: no React Compiler and about 27 contexts take an inline value object (`app-shell.tsx:50`, rebuilt on
every drawer or overlay change); `app-command-palette.tsx:24` reads `useSearch({ strict: false })` in the shell;
every feed card reads the device-preferences context; `ChannelBinding` publishes `currentTime` on every `timeupdate`
(`video-js-engine.tsx:215`) for no reader; 7 layout-animating rules (`transition-all` on the volume bar, the rail's
`width,margin`, liner notes `height`, progress `inline-size`, studio workspace, a settings preview, legacy scss).
Routes already preload on intent (`defaultPreload: 'intent'`, off under save-data or 2g, `router.tsx:14`).
[132](132-watch-page-queue-reorder-web-vitals-proof-and-view-transition.md) still owes the watch page's CLS proof.

**5. Motion.**
Tokens: durations instant, fast, base, slow, cinematic = 80, 140, 220, 360, 560 ms (standard; calm and reduced sets),
easings standard, enter, exit, settle. 22 `@keyframes`, about 63 `transition` utilities, 36 `animate-`, 38
`motion-reduce:` matches, 7 view-transition references; every navigation runs a view transition
(`packages/client/queries/src/app-router.tsx:53,91`). Reduced motion has no one global rule: it works through the
`reduced` motion set, a `motion-reduce` variant that matches the media query and `data-motion`, and view transitions
being off. Gaps: the legacy `* {transition...}` at `index.scss:21-26`, literal `duration-200`, no motion on queue
insert, remove or reorder (colour only), feed append, comment insert, tab panel swap, skeleton-to-content swap, theater
reflow. **Overlays have no exit animation**: the "/" palette and its overlay are gone by the first frame (10 ms) after
Esc or an outside click; open uses `motion-enter`. No lint or architecture check for motion exists.

**6. Settings.**
Three cookies, not one (the web AGENTS.md says `vp.device` holds the appearance, and the code does not):
`vp.appearance` (`packages/client/ui/src/appearance/preference.ts:90`, schema 2, theme, mode, accent, contrast and 9
token groups, 269 characters worst case, shared `COOKIE_DOMAIN` so web and studio see it), `vp.device`
(`features/settings/device/device-preferences.ts:62`, schema 1, 7 playback fields and locale, web only) and `vp.sidebar`.
All are one year, SameSite=Lax, not HttpOnly. `vp.device` is `z.literal(1)`, so a schema mismatch resets the whole
cookie. The root `beforeLoad` reads both cookies and `ThemedDocument` writes the `data-*` attributes before paint.
Merge on sign-in is **per section**, not per field. **No cross-tab sync for the cookies**, and the device provider
writes from in-memory state (`device-preferences-provider.tsx:36-50`), so a stale tab overwrites another tab's
playback or locale. Provider state is never re-seeded after mount. localStorage keys, all of them: `vp.locale` (legacy),
the list-view key (`modules/shared/hooks/useInView.ts:9`), the install-prompt dismissal (`features/pwa/use-install-prompt.ts:25`);
studio has none. **`/settings` has no link anywhere** (not the account menu, shell destinations or palette).
Gaps in the UI only: no basic "Roundness" row (radius sits on Advanced), density is a binary spacing and sizing
toggle with no `data-density` attribute, contrast does not follow `prefers-contrast`.

**7. Queue.**
State is page-local (`use-playback-queue.ts:8`), seeded with the open video, lost on navigation. Panel: 25rem wide
(26.25rem at `large`), sticky, list scrolls; measured 400 x 736 at 1280, 620 x 865 at 768, a "Queue" button at 375 and
320, showing "1 / 1" plus "More like this". **No "Add to queue" anywhere**: the home card menu holds Save, Not
interested and Don't recommend; search rows hold Save; a recommendation row's "More actions" holds only Delete;
`onQueue` is passed in code and `enqueue` is never returned. There is no "play next". The card menu is `opacity-0`
until hover or focus on a mouse, always on for touch, and a guest gets no menu at all (`VideoCardMenu` returns null).
The toast takes one action, so Undo is possible. `QueueModes` exists and `WatchQueue` does not render it.

**8. Mini player.**
No PiP, no mini player, no `requestPictureInPicture` anywhere; Video.js 10.1.0's types carry PiP state and the player
port does not expose it. The engine tree sits inside the route `Outlet` and unmounts on every navigation, so one
instance cannot move today. A mount point that survives navigation is `RootShell` (outside the `Outlet`).
`PlayerChannelProvider` is created per page. The service worker caches art and `.m3u8` playlists and does not
touch the queue. 73 section 6 specifies persistent playback and is still in progress.

**9. Hover preview.**
Measured: hovering a home card for 500 ms opens the Expanded panel (description and Save), with no playback; it
covers the title, owner chip and meta, extends about 12 px past the card, is clipped on the left by the shelf and
shifts no neighbour. Panel height is 76 px (1-line title) or 95 px (2-line title): **a 2-line title is cut in half**.
The API has a sprite sheet and an HLS URL and no preview clip; the worker makes only the poster and the sprite.
Save-data and 2g are not checked in the card.

**10. Overflow.**
The header's right cluster ends at x = 393, so **every page scrolls horizontally: 73 px at 320 and 18 px at 375**
(web), 79 and 24 (studio). Search results overflow 230 px at 320 and 175 px at 375 (the tab chips and the Relevance
button neither wrap nor scroll). The share dialog fits at 375 with a 16 px gutter and truncates the link. Code:
`share-dialog.tsx` is always a centred Dialog (never a drawer), the row at line 30 is `flex` with `Field.Root flex-1`
and `Field.Root` has no `min-w-0` (`field.variants.ts:8`), so the input keeps its ~20ch intrinsic width; there are
no social targets and no Web Share API; the viewport meta has no `viewport-fit=cover`, so `env(safe-area-inset-*)`
is 0. About 55 overlay usages: all Dialogs and AlertDialogs except the 3 `ResponsiveModal` sites are centred cards
on a phone (upload, admin, command palette among them); Popover and HoverCard have no `max-h`; the studio upload
widget is fixed to the bottom with no safe-area padding. Menus and Selects already cap their height.

**11. Shorts.**
Measured: the URL stays `/shorts`; the share link is `http://localhost:5173/watch/<id>`, from `share-dialog.tsx:22`
which hardcodes `/watch/$videoId` and is reused by `shorts-feed-actions.tsx:74` with `startAt=0`. The real route is
`/shorts/$videoId`, and `/watch/$id` does not redirect a short (`routes/watch.$videoId.tsx:26-47`). The feed is not
a scroll container: no snap, no virtualisation, no observer; exactly one Short is rendered with `key={short.id}`
(`shorts-feed-frame.tsx:66`), so **every step remounts the whole player and rebuilds hls.js**, and each move is a
router `navigate` with loaders. Only the next 2 posters are preloaded; no video is. Controls present: Prev, Next (fine
pointers only), Pause, Mute (only while muted), Like, Discussion, Share, Save. Missing: seek bar (a 3 px `aria-hidden`
bar, not scrubbable), captions, speed, subscribe, any mute control once unmuted. Arrow keys and Space do nothing until
the section has focus; the wheel advances (24 px threshold, touch swipe 48 px, no drag-follow, no `touch-action`);
no focus on open; no orientation or safe-area handling. `setProgress` on every `timeupdate` re-renders Caption and
Actions with no memo. A guest's Like, Discussion and Share do nothing visible. Console: `ERR_BLOCKED_BY_RESPONSE.NotSameOrigin` twice.

**12. Forced sign-in.**
`requireSignedIn` (`packages/client/queries/src/route-guards.ts:31`) guards `_authed` in both apps and carries
`redirect=<href>`, validated same-origin; `leaveLoginWhenSignedIn` honours it. Actions that navigate to `/login`:
`useSignIn` (`features/auth/hooks/use-sign-in.ts:8`; reactions, subscribe, clip, save-to-playlist), `channel-result-header.tsx:34`,
plain links (home hero, account menus, comment thread, settings sign-in). The return-to page is honoured, the action
is never replayed. Hidden for a guest with no explanation: card Save and Queue, the watch-page Save, the shorts and
pick-of-the-day Save, the notification bell, recommendation feedback. Measured guest matrix:

| Guest clicks | Today |
|---|---|
| Like, Dislike, Subscribe, Clip (watch page) | redirect to `/login?redirect=...` |
| Subscribe (channel page) | **two white `react-toastify` toasts** "You must be logged in to subscribe to a channel", stays on the page |
| Save, notification bell, card menu | hidden |
| Like, Discussion, Share (Shorts) | nothing visible |
| Header "Sign in" on `/login` | nests the `redirect` param inside itself |

Member-only routes: web `/clips`, `/feed/you`, `/feed/history`, `/subscriptions`, `/subscriptions/videos`; studio: every
route except `/login`, admin also role-gated. There is no `Queue` subject in `@vp/permissions`.

**13. Contrast.** (script and every row: 1632 pairs over sand and nocturne, light, dark and oled, standard and
`more`; 200 fail, 37 are pairs the code draws). Used and failing:

| Theme and mode | Pair | Ratio | Floor |
|---|---|---|---|
| sand light | success-ink on tint-strong / bg | 3.84 | 4.5 |
| sand light | success-ink on tint-strong / surface, raised | 4.18 | 4.5 |
| sand light | success-ink on tint / bg | 4.20 | 4.5 |
| sand light | warning-ink on tint-strong / bg | 4.22 | 4.5 |
| sand light | fg-muted on tint-strong / bg | 4.38 | 4.5 |
| sand light | info-ink on tint-strong / bg | 4.39 | 4.5 |
| sand light | success-ink on accent-soft (bg, surface, raised) | 4.41 | 4.5 |
| sand dark | fg-muted on tint-strong / raised | 4.17 | 4.5 |
| sand dark | fg-muted on accent-soft / raised | 4.46 | 4.5 |
| sand dark | danger border (`aria-invalid`) on raised | 2.99 | 3 |
| nocturne light | success-ink on tint-strong / bg | 3.98 | 4.5 |
| nocturne light | success-ink on tint-strong / surface, raised | 4.26 | 4.5 |
| nocturne light | success-ink on tint / bg | 4.35 | 4.5 |
| nocturne light | warning-ink on tint-strong / bg | 4.38 | 4.5 |
| nocturne light | fg-muted on tint-strong / bg | 4.44 | 4.5 |
| nocturne dark | border-strong on raised (inputs in dialogs and popovers) | 2.74 | 3 |
| nocturne dark | fg-muted on tint-strong / raised | 4.35 | 4.5 |

`contrast=more` fixes `border` and `fg-muted` only; the tone inks fail the same way under it. Roles outside the
test that fail: `fg-subtle`, the placeholder colour, 22 uses (`input.variants.ts:16,18`, `command.variants.ts:10`,
`select.variants.ts:7`): 3.47 to 3.79 in the light themes; it is the same reference as `border-strong` in light, so
raising one raises the other. `choice-cards.tsx:52` draws a selectable radio card with the hairline `border` alone
(1.2 to 1.46). Measured in the app: the search trigger's border is 1.24 to 1.42 against 3:1 in every theme; the "/"
kbd is 2.58 and 2.63 in light and 1.14 and 1.16 under high contrast. Everything else sampled passes. Settings offers
Sand and Nocturne, each with System, Dark, Light and OLED.

**14. Player controls on a dark frame.**
Cause, code: `video-js-engine.tsx:103` sets `data-theme="dark"`, and only `sand` and `nocturne` exist as theme ids
(`generated/themes.css`), so the player inherits the page's theme and mode; in light mode the container is `bg-bg`
(a cream letterbox), the icons are `--fg` (#1C1915) on a `--scrim` of the same colour at 60%. Computed against a
black frame: 1.08 in light themes, 1.75 on mid-grey, 3.8 on white; the dark themes pass (6.8 to 17.9). The control bar
is a 48 px gradient from `scrim`; the seek and volume bars are native `input[type=range]` with only `accent-accent`
(`control-bar.tsx:65,129`), no buffered range, no sprite preview, no text or icon shadow. Controls auto-hide, so the
dark-frame screenshot per theme is not taken yet. 57 is marked done and the player has no big play button, buffering
spinner, captions, stats overlay or ambient toggle: the captions and stats settings exist and nothing reads them
([134](134-settings-readers-account-switch-and-channel-image-upload.md) owns the readers).

**15. Backgrounds.**
Pages use `bg`, cards and tables `surface`, floating layers `raised`, media `bg-media`. Outliers: the player container
(14); **the web `body` background is never set by the app or `@vp/ui`** and comes from Bootstrap's `--bs-body-bg`
(#fff, `data-bs-theme` never set), so the canvas, overscroll area and the gutter strip are white in dark mode (code;
studio sets `body{background:var(--bg)}` at `studio.css:3`); header and tab bar are `bg`, the now-playing bar `surface`,
the rail transparent; header is `bg/90` with a blur and the tab bar is opaque; the settings tiles mix `bg`, `surface`
and `raised` (`choice-cards.tsx:52`, `theme-row.tsx:15-18`, `advanced-preview-panel.tsx:13`, `token-previews.tsx:6`).
In both themes light `raised` equals `surface`, and Nocturne sets `shadow: flat`, so a popover on a card is
separated only by a 1.2 to 1.3:1 hairline.

**16. Ambient colour.**
`use-ambient-sample.ts`: a 3 x 1 canvas, the video path capped at 12 fps with `requestAnimationFrame`, reduced
motion read once and not reactively (`:99`). Production passes only the poster (`watch-stage.tsx:23`), so the video
path is dead code and the glow is one static poster sample. Size: `-inset-[5rem]` (80 px) on all four sides, hidden
below `medium`, `blur-ambient` 56 or 70 px. It does not reach the header or rail because the stage root is `isolate`
(the glow's `-z-10` stays inside), no ancestor clips it, the bleed is a fixed 80 px, and the header is `z-sticky` at
`bg/90` with a blur. Save-data and 2g are not honoured, and `data-ambient=off` only hides it in CSS while the hook
keeps sampling. Measured: the stage ground is 708 x 398, the same as the stage, with no glow visible.

**17. Studio.**
Routes: `/videos`, `/videos/$id/edit`, `/videos/$id/analytics`, `/analytics`, `/customization`, `/upload` (redirects to
`/videos` and opens the dialog), `/admin/{categories,moderation,queues,curation}`, `/login`. `/admin/curation` is
missing from studio's AGENTS.md routes row. No stub or TODO in the source. Measured: there is no settings page or
featured shelf route; `/videos/<id>` is a 404; the videos table is 1339 px wide so the page scrolls 59 px at 1280 and
the Actions column is clipped; the edit page overflows 10 px at 1280 and 768; the upload dialog at 375 is 377 px wide
with no gutter and its title input overflows. Code: only `/videos` has its own skeleton; edit, customization and admin
have none; analytics has no zero-data empty state; the table scrolls only sideways on a phone; upload and admin
dialogs are not drawers.

**18. Local login.**
There is no password login. The persona switcher on `/login` loads only when `import.meta.env.DEV` (`routes/login.tsx:7-13`);
a production build shows `auth.noProvider`, so **the demo stack, which serves production builds, has no way in**.
`signInAsPersona` is a server function that fetches a token from `http://localhost:3002/token` (`dev-token serve`,
which `demo/start.sh` does not start) and sets the cookie. It is kept out of production three ways: the `DEV` gate, its
own `@vp/queries/dev-personas` export subpath and the bundle guard that fails a build with a `dev-only/` folder in a
chunk. `demo/login.sh` (demo worktree only) mints a 24-hour token and prints a console snippet; `creator2` and
`moderator` exist only there. `vp.session` has no `Domain` locally and cookies ignore ports, so :5173 and :5174 share it.
**The dev server does not hydrate on web or studio**: "Uncaught SyntaxError: The requested module
'/@fs/.../react-dom@19.3.0.../server.browser.js' does not provide an export named 'default'", no `__react` keys on any
button (so a dev-server click does nothing), plus a Manifest syntax error on web dev. The production build hydrates.
No app code imports `react-dom/server`: the default import is in `@tanstack/react-router@1.170.41`
(`ssr/renderRouterToString.js:2`, `renderRouterToStream.js:2`), reached through `ssr/server` and
`@tanstack/react-start/server`; `server.browser.js` is CommonJS. Start's plugin excludes `react-router` and
`react-start` from the client `optimizeDeps` and includes `react-dom/server` for server environments only, so any
client-reachable import of the Start server entry hits it in dev. Candidates: `ui/src/cookies/cookie.ts:2`,
`queries/src/session-cookie.ts:1`, `queries/src/api-proxy.ts:1`, the dev personas chunk. Dependency versions did not
change in two weeks, so this looks like a client-reachable server import on main meeting an upstream design; the importer
is not identified yet (slice a1 finds it).

**19. Search results.**
`routes/search.tsx` puts `type` in `loaderDeps` and awaits the new fetch with `pendingComponent: SearchPageSkeleton`,
which replaces the whole page, tab bar included, with an `aria-hidden` skeleton while the fetch runs. The owner reports
the tabs become unclickable after a few clicks. **Not reproduced** in the production build (sequential clicks, rapid
clicks, Slow 3G with 4x CPU: `elementFromPoint` always hit the tab); the cause is therefore a hypothesis, the swap
described above, and slice b2 must reproduce it first and record the trace. Measured: counts show only on the selected
tab ("All 2", the rest bare; the chip bar renders `count` only when `counts[option]` is defined), and the Videos tab
pulls 11 category chips into the same radio group. The tab switch has no animation.

**20. Hit areas.**
The channel result header on `/search` is clickable over **5%** of its area (name, avatar and the buttons only). Playlist
and video result rows are 100%, home cards 100%, two Start here cards 88%.

**21. Inconsistent avatars and Subscribe.**
The channel page renders the legacy react-bootstrap header (`modules/UserPage`): an empty 104 px circle for an avatar
with no initial, and a pale grey 42 px Subscribe (`rgb(232,233,239)`, Sora). Three Subscribe variants exist live (the
gold pill on search and the watch page, this one, the legacy toast path). Every avatar uses the `Avatar` primitive except
the channel page; comment avatars have an empty fallback (30 of 30). `Start here` cards overlay the category badge on
the index badge.

**22. Other sloppiness found while clicking.**
"Watch later" links to `/playlist?list=` (empty id); a duplicate view-transition-name error and "Snapshot capture
failed" in the web console; a PWA install banner on every page (the 0.094 shift); the search trigger and "/" kbd
contrast above; the Videos tab chips mixed into a radio group; a recommendation row menu with only "Delete"; the guest
Shorts actions that do nothing; the studio findings above.

## What to build

Four stacks, three slices each, planned here and again in each stack's feature PR body. A stack is a `gh stack` of
slices on `feat/136<letter>-<slug>` ([git-and-pr-conventions](../standards/git-workflow.md)); the grouping is by the
files the slices share, so a stack's slices touch the same folders and rarely meet another stack's.

**Order.** Stack A first (a1 makes every later click-through possible), then B, then C, then D. Two exceptions: slice d3
(studio) may start once A has landed, because it shares no file with B or C; slice c3 (the persistent playback host)
lands before d2 (Shorts), because Shorts needs the engine to outlive a route change. Nothing in 136 starts before 131 is done.

Every slice ends the same way: the app launched and clicked through in a real browser (acceptance criterion 1), the
before and after table in the PR, and the architecture or lint check for its rule with a fixture proving it fires.

### Stack A: `feat/136a-foundations` (root fixes, so the rest builds on them)

**Slice a1: local demo login and the hydration defect.**
1. Find the client-reachable importer of `react-dom/server` (request initiator in DevTools, one run with a cleared
   `node_modules/.vite`, then `rg` the candidates under "Today" 18) and fix it at the source (a server-only import
   moved behind the server function boundary, or `react-dom/server` added to the client `optimizeDeps.include` when the
   importer is Start's own); when the cause is upstream, pin or patch nothing and file the ticket with the reproduction.
   Done when both apps hydrate in the dev server, a test or an e2e step asserts `__reactFiber` keys on a button after
   load in dev, and the Manifest syntax error is gone.
2. A one-click local sign-in in a production build: a build-time key `VITE_DEMO_PERSONAS` (default false), parsed in
   each app's `src/config` (a `VITE_*` key lives outside `env-schema`, as `.env.example` says), gating the lazy import
   of the persona switcher so it is dead-code-eliminated when off; the switcher moves out of the guarded `dev-only/`
   folder, and the bundle guard checks the flag instead of the folder (a real deployment's build fails if the persona
   code is in any chunk). The token source stays HTTP (a client app cannot import a server package): the URL is a
   server-only key following the `SSR_API_BASE_URL` precedent, declared in `env-schema` and mirrored in `.env.example`
   (Rule 3).
3. `demo/start.sh` starts `dev-token serve`, passes the flag, and offers the personas `login.sh` offers (viewer,
   creator, creator2, moderator, admin, guest); `demo/login.sh` stays as the fallback. The shared session works on both
   origins. Documented in `docs/LOCAL_FIRST.md` and the app AGENTS.md, one place each.

**Slice a2: layers (scroll lock, z scale, select, surfaces).**
1. **One scroll-lock rule**, in `packages/client/ui/src/styles/base.css`: `html { scrollbar-gutter: stable }` and
   `html body[data-scroll-locked] { margin-right: 0 !important }` (the library's rule is `!important` and injected
   later, so the extra `html` selector wins), and delete the Bootstrap-keyed rule in `index.scss`. Fix the scroll jump on
   close (restore `scrollTop` the library drops, or stop `position: relative` from being applied) and prove it with a
   classic scrollbar. Both apps, every locking overlay, no per-overlay code.
2. **One layer scale.** Extend `scale.z`: add the roles that have no layer (a `header` apart from `sticky` bars, `pip`
   between rail and overlay, `ambient` below the header, a `stage` set for the player's own overlay), give every role a
   distinct number unless two roles can never overlap (stated in the table), and replace the 24 raw values, the `9999`
   and `1000` legacy ones (retired with their owners, a ratchet until then) and the inline `zIndex = N - index`. A
   `zero-matches` row and a Biome rule ban `z-<n>` and `z-[<n>]` and `zIndex:` outside the generated scale.
3. **One `user-select` rule**: an `@layer base` rule in `base.css` over interactive roles and `kbd` (`button`,
   `[role=tab]`, `[role=menuitem]`, `[role=option]`, `kbd`, the chip, badge, tab bar and card chrome classes), the nine
   per-primitive `select-none` utilities dropped, and `select-text` as the opt-in for content (titles, descriptions,
   comments, chat, table cells, hints, errors). An architecture check fails a primitive's variants file that has
   an interactive role and sits outside the rule's list.
4. **Surface roles.** Write the role map (page `bg`, sticking chrome `bg`, rail `bg`, content `surface`, floating
   `raised`, media `media`, hover `tint`, pressed `tint-strong`, selected `accent-soft`), set `html` and `body` background
   and `color-scheme` once in `base.css`, give the player container `data-mode="dark"` plus `bg-media`, and fix the outliers
   in "Today" 15 by role. Light `raised` and `surface` get distinct values (or the border pair is tested and stays
   perceivable); the decision is made in the slice and recorded in the token file.

**Slice a3: tokens, contrast, the player scrim, overlay motion.**
1. Fix the tokens in the table under "Today" 13 (tone inks on tint, `fg-muted` on tint and accent-soft, `border-strong`
   on raised, the danger border, `fg-subtle` as placeholder, the control border of `choice-cards`, the search trigger
   border, the "/" kbd), never a component. `contrast=more` also fixes the tone inks.
2. Extend `REQUIRED_PAIRS` in `design-tokens` to every pair a component draws (tone ink on tint and tint-strong on
   bg, surface and raised; `fg-muted` and `fg-subtle` on every ground; `border-strong` on raised; the danger border; the
   focus ring against its ground; a control's border), for every theme, mode and `contrast`, with AA 4.5 for text, 3:1 for
   UI components and focus rings, and a fixture proving a theme under the threshold fails. The audit script becomes this
   test; the result table is in the PR.
3. **Media roles**: `--media` (black) and `--on-media` (white) fixed in every theme, a taller fixed-black scrim and a top
   scrim for the title in the player, the control icons and text on `on-media` with a shadow, a custom seek track with a
   visible buffered range and a focus ring that clears 3:1 on both a black and a white frame. The player screenshot test
   draws bright, black and mixed frames in each of the six theme and mode variants.
4. **Overlay exit motion in the primitives**: Dialog, Drawer, Popover, Menu, Select, Command and Toast keep their content
   mounted for the exit (Radix `data-state=closed` animation, `exit` easing, the `fast` duration), so the palette, a
   dialog and a drawer all animate out; reduced motion makes it an opacity fade.

### Stack B: `feat/136b-shell-and-feel`

**Slice b1: speed and overflow.**
1. Measure first: a repeatable click-path script (`e2e/perf/`, `pnpm perf:clicks`) that records CLS, long tasks, INP and
   layout-shift sources through `PerformanceObserver`, and prints the before and after table; `web-telemetry` gains long
   tasks and the shift source. The baseline is the numbers under "Today" 4.
2. Fix the causes, one commit each, each with its row in the table: the install banner and hero mounting that cause the
   0.094 shift (reserve their space), the palette's 216 ms keystroke, context values that rebuild on every change
   (`app-shell.tsx:50` and the other inline value objects), `ChannelBinding`'s per-`timeupdate` publish, the shell's
   `useSearch({ strict: false })`, the device-preferences context every card reads, skeletons that match the final size.
3. The 320 and 375 px horizontal scroll (the header's right cluster, search results' tab chips and sort button wrap or
   scroll inside their own box), and the studio's table, edit page and upload dialog widths.

**Slice b2: transitions and the search results.**
1. The missing motion from the design system's tokens: route changes, list insert and remove (queue, feed append,
   comments), tab panel swap, drawer, menu, toast, skeleton-to-content, theater reflow; compositor properties only
   (`transform`, `opacity`), `view-transition` and CSS transitions, no layout-animating property (the 7 hits are fixed).
2. **Search tabs**: reproduce the lock first (record the trace, with a real pointer and the hypothesis in "Today" 19
   as the first guess), then keep the tab bar mounted while a tab loads (a transition, not the whole-page pending
   component), show every type's count at all times (verify first whether the search response carries a count per
   type; if it does not, add `counts` to the response, the contract and SDD section 6.1 in the same slice), keep the
   chips of Videos out of the type radio group, and animate the result swap.
3. A **motion check**: an architecture test that finds an interactive primitive (a variants file with an interactive
   role) with no `transition` or `animate-` and no `motion-reduce` guard, a Biome or zero-matches ban on a literal
   `duration-<n>` and `transition-all` outside the token utilities, a single global `prefers-reduced-motion` rule, and
   fixtures. The legacy `* { transition }` in `index.scss` goes if 62 has not removed it.

**Slice b3: polish and consistency.**
1. **Hit areas**: a result row or a card is one link over its whole box (a stretched link: one `<a>` with an `::after`
   inset, nested actions above it); the channel result header goes from 5% to 100%, the two Start here cards from 88%.
   An e2e step samples a grid of points over each result row, card and header and asserts the target.
2. **Avatar and Subscribe once**: the channel page uses `ChannelHeader` from the kit (the legacy `modules/UserPage` is
   gone when 62 lands; if it is not, this slice deletes it), every avatar renders `Avatar` with an initial fallback
   (comments included), and one `SubscribeButton` replaces the three variants. The `Start here` badge overlap is fixed.
3. **Hover card**: the title is never clipped (the panel measures its content and grows by at most one line, 24 px),
   no neighbour moves.
4. **Ambient colour**: a page-level layer on the new `ambient` z role, below the header and above the page background,
   sized from the stage (a ratio of the stage box, not a fixed 80 px), clipped by the page not the stage, reaching under
   the sticky header and the rail, sampled as today (no new per-frame cost), static under reduced motion read
   reactively, and not sampling under save-data, 2g or `data-ambient=off`.

### Stack C: `feat/136c-features`

**Slice c1: the in-place sign-in prompt and the settings page.**
1. **One answer for a guest.** A `sign-in` entry in the url-modal registry (`reason`, `redirect`, `intent`), opened by one
   `useRequireAccount(action)` hook that every account action calls in place of `useSignIn`, a hand check or a toast:
   like, dislike, comment, reply, heart, subscribe, save, playlist, queue, clip, history, report, the bell, feedback.
   The modal says why ("Sign in to like this"), has one primary call to action and a dismiss, is a Dialog from 600 px
   and a Drawer below, and on sign-in returns the viewer to the same place and replays an idempotent intent (like,
   subscribe, save) once; the others return without replaying. The decision is `useCan` over `@vp/permissions` with
   a `Queue` subject added (guest rules first, no hand check, Rule 1); a control a guest cannot use stays visible and
   opens the prompt, so none is hidden without a reason. The redirect stays only for the member-only routes in
   "Today" 12, and `requireSignedIn` is unchanged. `react-toastify` and the legacy channel-header toast are removed with
   the second toast system; the header "Sign in" link stops nesting `redirect`.
2. **The settings page.** `/settings` already exists and is open to guests: link it (account menu, shell, command
   palette), add a "Roundness" row (the `radius` token) and a density row (a `data-density` attribute over `spacing` and
   `sizing`) to Appearance, make `contrast` follow `prefers-contrast` until the viewer chooses, keep motion and font
   size where they are, and add the new `hoverPlay` playback field (c2). **Storage, decided** (see the section below).

**Slice c2: queue, play next and the hover preview.**
1. **Queue panel**: a persistent panel (73's queue, not page-local) with a larger default (a third of the viewport
   height minimum on a phone drawer, full height on desktop), its own scroll, visible drag handles, keyboard reorder, a
   header with the count, `QueueModes` rendered, and an empty state that explains how to add.
2. **Add and play next**, `enqueue` and `playNext` returned by `use-video-actions` and shown, not only in a menu, on
   cards (a visible action on hover, focus and touch), the watch engagement bar, search result rows, the recommendation
   row menu and the shorts actions; each gives a toast with **Undo** (the `Toast` primitive's one action), one
   `queue` permission (guests get the prompt from c1).
3. **Hover preview**: `VideoCard.Thumb`'s `previewSrc` seam stays; v1 plays the sprite sheet frames muted at about 4
   frames a second on a compositor-friendly layer (a transform over an `overflow: hidden` image, no extra request: the
   sprite is already cached by the service worker), after a 500 ms rest, one preview at a time, mouse and fine pointer
   only, no layout shift. The Expanded panel is separate and keeps its own setting. New playback field `hoverPlay`
   (default on), forced off under save-data, 2g and reduced motion; the choice and its default are recorded in the
   catalogue and SDD section 6.1 with the new field.

**Slice c3: the persistent playback host and the mini player.**
See the section below. Lands before d2.

### Stack D: `feat/136d-shorts-share-studio`

**Slice d1: share and every overlay.**
1. **Share**: one `shareUrl(kind, id, { startAt })` builder in `@vp/queries` (or `lib/`), `watch` and `shorts`
   producing `/watch/$id` and `/shorts/$id`; the dialog is a `ResponsiveModal` (drawer on a phone), the link field has
   `min-w-0` and truncates in the middle, a Copy button with a confirmation, social targets (a fixed list of share URLs,
   no third-party SDK or script, Rule 6) and the Web Share API when `navigator.share` exists.
2. **Every dialog, drawer and menu** in both apps (the 55 usages) at 320, 375, 768 and 1280 px: `ResponsiveModal` for
   every dialog on a phone, `max-h` and `overflow-auto` on Popover and HoverCard, safe-area padding with
   `viewport-fit=cover` in both apps, the studio upload widget's bottom inset. The defect list is a checklist in the PR,
   one line per overlay, each ticked with the width it was verified at.

**Slice d2: Shorts.**
Rebuild the Shorts UI on the persistent engine (c3): a scroll-snap vertical container (`scroll-snap-type: y mandatory`,
`overscroll-behavior: contain`, `touch-action: pan-y`), the current short with the next and the previous mounted as
paused, preloaded players (one extra engine at most, hls.js built once), no router navigation per step (the URL updates
with `history.replaceState` through the router's `replace`), a real control set, all with accessible names and a visible
focus ring: play and pause, mute and unmute, a scrubbable progress bar, captions, like, comment, share, subscribe, speed,
previous and next, keyboard (Arrow keys, J/K, M, Space, C, L work from the first focus, and the section takes focus on
open), wheel, touch swipe with drag-follow, and the right behaviour on resize and orientation change (the current short
stays in view, safe-area padding). `setProgress` is isolated so the caption and actions do not re-render each
`timeupdate`. Guest actions use the c1 prompt.

**Slice d3: the creator studio.**
Audit and fix every studio page and flow for the same classes (1 to 16) and for broken, empty, error and loading states:
`/videos` (the table's 1339 px width, the Actions column, batch actions), upload (a drawer on a phone, 377 px at 375),
edit (10 px overflow), analytics (the zero-data empty state), `/customization` and the admin pages (skeletons), the
login page (a working local sign-in from a1), a settings page and the featured shelf (build them if the ticket that
owns them did not, or list them under Out of scope with its number), `/videos/<id>` 404 as a redirect to the library,
and the AGENTS.md routes row. The checklist is in the PR with each item, the width and the theme it was checked in.

## Settings storage, decided

The first paint decides where a value lives. Three stores were weighed.

| Option | First paint | Cross-origin (web and studio) | Weight | Verdict |
|---|---|---|---|---|
| Cookie only (today) | right, the server reads it in `beforeLoad` | `vp.appearance` shares a domain, `vp.device` does not | sent on every request (about 450 bytes encoded for appearance, 280 for device) | right for what paints before React |
| localStorage only (the owner's ask) | **wrong**: the server cannot read it, so the page paints the default theme and flashes on hydration | per origin, so :5173 and :5174 cannot share a theme | none on the wire | wrong for anything the first paint shows |
| Both, by what first paint needs | right | appearance stays a shared cookie | cookie only for the paint-critical fields | **chosen** |

**Recommendation, both.** The cookie keeps exactly what the server render needs: the appearance fields
(`vp.appearance`: theme, mode, accent, contrast, radius, spacing, sizing, motion, fontSize and the other token groups,
which drive `<html data-*>` before paint and are shared with the studio) and `locale`. Everything else moves to
localStorage behind the same store interface: the playback fields (they are read after hydration, in `ClientOnly`
and in hover handlers, so a flash is impossible), the new settings-page fields, the mini player's position and size,
the queue panel state. The owner's localStorage ask is met for all of it except the fields that would flash.

- **One store, two backends.** A `device-preferences` module owns reads and writes; a field's backend is a column in
  the catalogue (`@vp/domain/settings`: `device: 'cookie' | 'storage'`), so a component never names a key or a store
  (it keeps `usePlaybackPreference(key)`, the web AGENTS.md rule).
- **Hydration.** The server renders from cookie fields only. A storage-backed field renders its catalogue default on
  the server and on the hydration pass and takes the stored value after mount (the `useStoredState` rule), never
  during render, so the markup always matches.
- **Merge on sign-in, per field, not per section.** The device keeps a `dirty` set: the fields changed on this device
  while signed out. On sign-in, a field that is not dirty takes the account's value; a dirty field uploads and wins,
  because the viewer chose it a moment ago; a dirty field whose account value differs raises one toast, "Kept your
  choice for <field>", with Undo (the account value comes back). A field the account never saved uploads as it is.
  No API change: `PATCH /v1/me/preferences` already merges by key and carries `version`.
- **Versioning and migration.** One schema version per backend and an ordered migration list
  (`migrations.ts`, each step a pure function with a test), run on read; an unknown or invalid field falls back to its
  default per field, never the whole store (today `vp.device`'s `z.literal(1)` resets everything). A downgrade (a newer
  version than the code knows) leaves the data untouched and reads the fields it understands.
- **Cross-tab.** A `BroadcastChannel('vp.prefs')` carries `{ field, value }`; the `storage` event is the fallback for
  browsers without it. Providers re-seed from the message, and every write re-reads the current value first (the
  appearance provider already does; the device provider writes from memory and must stop), so a stale tab cannot overwrite
  another tab. Cookie fields broadcast the same way, because a cookie raises no event.
- **Trade-offs written down.** Both backends mean two read paths and one more migration surface; one catalogue column and
  one module hold that. A localStorage-backed field is invisible to the server, so a future SSR need moves the field to
  the cookie (a catalogue edit and a migration, nothing in components). Cookies are capped near 4 KB and the appearance
  cookie is 447 bytes worst case encoded, so the budget is the check: a test fails the build if the worst case passes 1 KB.

## The mini player

**Decision: an in-page mini player, plus the browser's own Picture-in-Picture as a second button.** The in-page
player is the product: it follows the viewer across routes, works in Safari and Firefox and on a phone, shows the
queue's controls and is ours to size and to theme. The browser's PiP (`requestPictureInPicture` on the engine's
`<video>`, exposed through a new `pictureInPicture` command and state on the player port) is a floating OS window for
a viewer who leaves the tab; it adds one icon button where the API exists and nothing otherwise.

**One engine, no double playback.** A `PlaybackHost`, mounted in `RootShell` outside the `Outlet`, owns the single
engine instance and its `<video>` element for the whole session. The watch page and the mini player do not own a
player; they own a **slot**, a placeholder box. The host positions the one player over the active slot (`position:
fixed` plus a `transform` measured with a `ResizeObserver` and the slot's `getBoundingClientRect`, on the compositor), so
the element is **never reparented**: moving a `<video>` between parents detaches it and pauses it, and a second player
mounted beside it would double the audio. States: `docked` (a watch page with this video is open: the host sits over its
stage), `mini` (no stage slot: the host sits bottom right in the mini slot), `hidden` (nothing is playing, or the viewer
closed it). Opening a different video swaps the source in the same engine. The engine stays behind the TaitubePlayer port;
the port gains `pictureInPicture`, `dock(slot)` and `undock()` as commands, the Video.js adapter implements them in the one file
that imports Video.js, and `playback-tracker` and the history heartbeat keep writing as today.

- **Controls and state**: play, pause, close, expand (to `/watch/$id` at the saved position), previous and next from the
  queue (73), the title and channel as a link, a progress line; it remembers position (the history heartbeat and a local
  copy), corner and size (localStorage, c1's store), and is dismissed per video, not per session.
- **Never fights the main player**: when the viewer opens the watch page of the playing video the host docks and the mini
  player is gone in the same frame; on another video's watch page the mini player stays and pauses when the new video
  starts (one engine, so it cannot play two).
- **Mobile**: from the medium breakpoint down it spans the width above the tab bar (`env(safe-area-inset-bottom)`), a
  smaller fixed ratio, swipe down to dismiss.
- **Layer**: the new `pip` z role between rail and overlay, so a dialog still covers it and the header does not.
- **Queue**: it is the queue's playback surface; next and previous move through the persistent queue, an empty queue
  closes it at the end of the video, autoplay next follows 134's reader.
- **PWA**: the service worker is not involved (it caches art and `.m3u8` playlists and no segment); the Media Session API
  gets the title, artwork and the play, pause, next and previous handlers so lock-screen controls work; an offline saved
  video plays in the mini player from its cache the same way it does on the page.
- **Guards**: the player lazy chunk stays lazy (the bundle guard), the host mounts the engine only when something plays,
  and a navigation to a route without a stage does not rebuild it.

## Acceptance criteria

Each is proved by a test or a recorded artifact. The last one holds for every slice.

- [ ] **1. Launched and clicked.** For each slice, the app is launched for real (web :5173, studio :5174, the demo stack
      from `./demo/start.sh`) and clicked through with chrome-devtools-axi (`branch-validation`), each fix photographed or
      measured before and after at 320, 375, 768 and 1280 px, in light and dark, in Sand and Nocturne, and the PR says
      so with the screenshots or the numbers.
- [ ] **2. Scroll lock.** Opening and closing a Dialog, Drawer, Menu or Select in either app moves the content's bounding
      box by 0 px, with a 15 px classic scrollbar emulated, and restores `scrollTop` exactly on close (700 stays 700).
      One rule in `base.css`, no per-overlay padding; `e2e/` compares the box before and after for every locking primitive.
- [ ] **3. Select.** The one `user-select` rule exists; every interactive role and `kbd` computes `none`; titles,
      descriptions, comments, chat and table cells compute `text`. An architecture check fails the rule's absence on a
      new interactive primitive, with a fixture.
- [ ] **4. Layers.** Every `z-index` is a role of the scale, the numbers are distinct or the table says why not, `rg` finds
      no raw `z-<n>`, `z-[<n>]` or `zIndex:` outside the generated scale (the legacy ones counted down to 0 by their owners),
      and a lint or `zero-matches` rule with a fixture fails one. `react-toastify` is gone.
- [ ] **5. Speed.** The click path's CLS is below 0.05 (from 0.095), long tasks do not rise (2 and 128 ms today), a "/"
      palette keystroke is under 100 ms (from about 216), no interaction re-renders the whole shell (a commit count per
      interaction, from the React profiler in a development build), and the before and after table is in each PR.
- [ ] **6. Motion.** Every overlay, tab swap, list change, route change and toast in the list under "Today" 5 has an
      enter and an exit from the motion tokens, none animates a layout property, `prefers-reduced-motion` and
      `data-motion=reduced` leave opacity and colour only everywhere, and the motion check fails a surface without one (fixture).
      The palette's close shows a frame sequence at 0, 50, 100, 200 and 400 ms in the PR.
- [ ] **7. Settings.** `/settings` is linked, open to a guest, offers Roundness, density, motion, contrast and font size,
      persists them on the device for a guest (cookie for the paint fields, localStorage for the rest, per the decision) and
      syncs them on sign-in by the per-field rule with the conflict toast; a field survives a reload with no theme flash; two
      tabs agree through `BroadcastChannel`; a migration test runs every version step; the cookie-size test holds. `e2e/`
      covers guest persistence and sync after sign-in.
- [ ] **8. Sign-in prompt.** No guest action redirects to `/login` except a member-only route; every account action in
      the list under c1 opens the one prompt with its reason, a dismiss and a return to the same place, and replays an
      idempotent intent once; no control is hidden from a guest without a prompt; no hand check (Rule 1), `useCan` over
      `@vp/permissions`; one toast system. `e2e/` asserts the prompt instead of a redirect, for like, subscribe, comment and save.
- [ ] **9. Queue.** The queue is persistent, roomy and keyboard-reorderable; add-to-queue and play-next are visible on
      cards, the watch page, search rows and menus, with a toast and Undo; an e2e step adds, undoes, reorders with the keyboard
      and plays next.
- [ ] **10. Mini player.** A viewer who starts a video and navigates (home, search, a channel, settings) keeps playing
      in the mini player at the saved position with play, pause, close and expand; exactly one `<video>` element exists in the
      document at any time (asserted); docking and undocking never pauses or restarts it; at 375 px it clears the tab bar;
      it sits on the `pip` layer; the browser PiP button appears where the API exists. `e2e/` covers the PiP following a
      route change.
- [ ] **11. Hover.** `hoverPlay` plays the muted frame preview after a delay, one at a time, never under save-data, 2g,
      reduced motion or the setting off, with no layout shift (the card's box is unchanged); the Expanded panel's title is
      never clipped, growing by at most 24 px.
- [ ] **12. Overflow.** No page scrolls horizontally at 320 or 375 px in either app; the share link, the search results'
      tabs and every overlay in the d1 checklist fit at 320, 375, 768 and 1280; the share dialog is a drawer on a phone.
- [ ] **13. Shorts.** The share link of a short is `/shorts/<id>` (a test on the builder and an e2e step); the feed
      snaps; the next and previous short are preloaded; the full control set of d2 is present and keyboard-, wheel- and
      swipe-operable with accessible names; resize keeps the current short in view; hls.js is built once per engine, not per
      step; no console error. `e2e/` covers the share URL.
- [ ] **14. Contrast.** The `design-tokens` test fails a theme below 4.5:1 for text and 3:1 for UI components and focus
      rings over every theme, mode and `contrast`; the failing pairs in "Today" 13 are fixed in the tokens (the PR lists
      each ratio before and after); a fixture proves it fires.
- [ ] **15. Player controls.** The control bar, overlays, progress bar and focus ring are readable on a black, a white
      and a mixed frame in all six theme and mode variants (screenshots), with a scrim that does not depend on the page theme.
- [ ] **16. Backgrounds.** Every surface maps to one role in the written map, the outliers in "Today" 15 are fixed, `html`
      and `body` have a background set once, and a dark-mode overscroll or gutter strip is not white.
- [ ] **17. Ambient.** The glow is sized from the stage, passes under the sticky header and the rail, adds no per-frame
      cost beyond the existing sampling, and is static under reduced motion and off under save-data and 2g.
- [ ] **18. Studio.** Every page and flow in "Today" 17 is audited, the defect checklist is in the PR with each line
      ticked at its width and theme, and the broken, empty, error and loading states exist.
- [ ] **19. Local login.** `./demo/start.sh` then one click on a persona signs in on `/login` in a production build of web
      and of studio, the session is shared, the dev server hydrates on both apps, and a production build for a real
      deployment contains no persona code (the bundle guard fails it otherwise). Documented once.
- [ ] **20. Search results.** The tab bar stays mounted and clickable while a tab loads, every tab shows its count at all
      times, the swap animates, and the lock is reproduced and recorded before it is fixed.
- [ ] **21. Hit areas and consistency.** A result row, a card and a header is clickable over 100% of its box (an e2e grid
      sample); one avatar look with an initial fallback and one Subscribe everywhere.
- [ ] **22. Other defects.** Each item in "Today" 22 is fixed or listed with its owner and a reason.
- [ ] **23. No regression.** The unit, jsdom, bun, e2e and visual suites are green; a visual baseline changes only for an
      intended change and the PR says which. A PR draws 2 of the 6 theme and mode variants and main draws all 6, so every
      story a slice changes gets its missing baselines drawn in that slice.
- [ ] **24. Gates.** `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:bun`, `pnpm test:architecture`,
      `pnpm boundaries`, `pnpm knip` and `make smoke-offline` green, with output in each PR.

## Out of scope

- A new design system, new token sets or themes ([95](95-design-system-2.md), [106](106-channel-branded-and-user-built-themes.md));
  this ticket fixes tokens and adds roles to the existing sets.
- The locale rollout and a language selector ([86](86-localisation-rollout-locale-negotiation-rtl.md)).
- The OIDC provider; the local persona switcher is a local and demo tool, not a sign-in method for a deployment.
- Anything 131 owns: folder moves, names, the folder-shape rules.
- A worker-made preview clip for hover (a `preview.mp4` stage, a storage key, a job and an SDD change): a follow-up
  ticket; `previewSrc` stays the seam.
- Playback readers for quality, speed, captions and the stats overlay, and the account switch reset
  ([134](134-settings-readers-account-switch-and-channel-image-upload.md)); the player scrim here does not read them.
- Live chat and notifications beyond their sign-in prompt and overflow.

## Testing plan

- **Browser, every slice**: chrome-devtools-axi on the demo stack, the method of the `branch-validation` skill (a
  main-versus-branch run, three runs alternating, the median, the limits stated), screenshots at the four widths in
  light and dark and two themes, committed to the PR and not the repo.
- **`e2e/`** (Rule 10), one file per behaviour that can regress: `layout-stability.test.ts` (content box before and after
  each locking overlay, with an emulated classic scrollbar), `sign-in-prompt.test.ts` (the prompt instead of a redirect,
  return and replay), `shorts-share.test.ts` (the `/shorts/<id>` URL and the control set), `mini-player.test.ts` (the
  player following a route change, one `<video>`, dock and undock), `settings-persistence.test.ts` (guest persistence,
  sync after sign-in, two tabs), `queue.test.ts` (add, undo, keyboard reorder, play next), `hit-areas.test.ts`, and the
  studio flows in the studio's `e2e/`.
- **Architecture and lint, each with a fixture proving it fires**: the z-index scale (a `zero-matches` row and a
  Biome rule), the `user-select` rule, the motion rule (a missing transition, a literal `duration-<n>`, `transition-all`),
  the persona-code guard in the bundle check, and the contrast test in `design-tokens`.
- **Unit and jsdom**: `useRequireAccount` over `renderRoute` with a guest, the migration steps and the per-field merge
  (an `it.each` over the table of cases), `shareUrl` per kind, the store's two backends and `BroadcastChannel`, the
  host's dock, undock and single-element rule.
- **Perf table in every PR**: CLS, INP, long tasks (count and ms), layout-shift sources, React commits per interaction
  (development build), before and after, from `pnpm perf:clicks`.
- **Regression**: the existing suites unchanged and green; story baselines drawn for all six theme and mode variants of
  every story a slice changes.

## Open questions

- **Decided: this ticket waits for 131 whole**, for the reason in the preamble; no slice but a1 may start earlier.
- **Slice a1 does not need to wait.** The persona switcher and the hydration defect live in `@vp/queries`, two small
  login routes and `demo/`, and the owner cannot click anything in studio until they land. Recommended: split a1 into its own
  small ticket that is not blocked by 131, and delete it from this one when it exists; it needs the owner's nod, so it is
  not done here.
- **Decided: both backends for settings**, cookie for what the first paint shows and localStorage for the rest. This
  departs from the owner's "localStorage" for the appearance fields and locale only, because a localStorage value cannot be
  read by the server render and the page would flash its default theme; flagged in the PR.
- **Decided: in-page mini player plus the browser's PiP button**, one engine that never leaves the document.
- **Decided: hover preview v1 is sprite frames**, not a video clip; the clip is a follow-up. New `hoverPlay` field, default
  on, forced off for save-data, 2g and reduced motion.
- **Verify at the start of b2: per-type search counts.** If `GET /v1/search` returns a count for one type only, the
  response gains a count per type (contract, `@vp/api-contracts`, SDD section 6.1 in the same PR).
- **Verify at the start of d3: who owns the studio's settings page and featured shelf.** The code has neither route; 96 and
  60 may have shipped them under another path. If they exist elsewhere, d3 lists them; if not, d3 builds or defers each
  with a named ticket.
- **134 overlaps c1 and c2.** 134 (ready, blocked only by 72) makes the player and the queue read the playback defaults;
  c2's hover field and c3's host read the same store. Recommended: 134 lands first, which needs nothing from the owner.
- **The search tab lock is a hypothesis.** It was not reproduced in a production build; slice b2 reproduces it first. If it
  only happens against the dev server, a1's hydration fix is the cause and b2 keeps the stay-mounted change on its own merit.

## Definition of Done

- [ ] All acceptance criteria proved with command output, screenshots and the before and after tables in the PRs.
- [ ] The design docs and standards updated where a rule moved: [docs/standards/design-system.md](../standards/design-system.md)
      (the layer scale, the `user-select` rule, the surface roles, the motion rule), [docs/design/foundations/motion.md](../design/foundations/motion.md),
      the web and studio AGENTS.md (settings storage, the sign-in prompt, the playback host, the demo login), the SDD section
      on preferences and the search contract when they change, and [ARCHITECTURE.md section 6](../../ARCHITECTURE.md#6-verification--enforcement)
      for each new check.
- [ ] Each stack's top slice marks its part in the ticket; the ticket is `done` when stack D lands.
- [ ] Ticket status set and `python3 docs/tickets/gen-index.py` re-run.
