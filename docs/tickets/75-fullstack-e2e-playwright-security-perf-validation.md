# 75: Full-stack Playwright E2E suite, security validation & end-to-end performance benchmarking

| Field | Value |
|---|---|
| Phase | 5 — Developer experience & growth |
| Issue | [#75](https://github.com/szebest/taitube-platform/issues/75) |
| Size | L |
| Blocked by | 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74 |
| Blocks | — |
| Spec | [PRD §1 Summary](../PRD.md#1-summary) · [SDD §11 Security](../SDD.md#11-security) · [SDD §13 Observability](../SDD.md#13-autoscaling-observability) |

**Status:** blocked

## What to build

With all backend capabilities, the modern TanStack frontend, URL-driven modal state, YouTube-grade playlists, multi-resource search, error resilience, and skeleton states integrated, we must **prove—not claim—that the complete platform is robust, performant, secure, and seamlessly integrated**.

This ticket delivers the **Full-Stack Acceptance Test Suite (make test-fullstack)**:

1. **Playwright Browser E2E Test Suite (`apps/web/e2e/`)**:
   - Automated browser testing simulating real user workflows end-to-end against compose infrastructure:
     - **Creator Workflow:** Log in as creator -> drag-and-drop upload video -> observe real-time live SSE progress bar update -> set title, category, tags -> view video reach `READY`.
     - **Viewer Workflow:** Anonymous browse home feed -> search video with typo -> open watch page -> verify Vidstack player streams 1080p HLS without buffering -> hover seekbar and verify storyboard preview -> like video (optimistic update) -> submit threaded comment -> verify comment appears instantly.
     - **Playlist & Queue Workflow:** Open watch page -> click "Save" -> verify `?modal=save-to-playlist` appears in URL -> create new playlist "Chill Beats" -> navigate to playlist page -> drag to reorder items -> click "Play All" -> verify player auto-advances to next video when current video ends while updating queue tray.
     - **URL-Driven Modal & History Workflow (The STS Pattern):** Click Share button -> assert `?modal=share` in URL -> press browser Back button -> assert modal dismisses without navigating away -> press Forward button -> assert modal re-opens -> refresh page -> assert modal remains open.
     - **Multi-Resource Search Workflow:** Focus search bar via `/` hotkey -> type creator handle -> assert suggestion quick-hit appears -> press Enter -> verify search results display spotlight Channel card, Videos, and Playlists with functional filter tabs.
     - **Admin Workflow:** Log in as admin -> enter `/admin` -> create category -> verify new category appears in public browse bar -> inspect BullMQ queue health.
     - **Resilience & Error Workflow:** Navigate to `/watch/invalid-video-id` -> verify custom `<NotFoundRoute />` renders without crash -> simulate 503 transient drop -> verify exponential retry recovers smoothly -> assert comment errors do not interrupt video playback.
     - **Visual Stability Workflow:** Emulate 4G network throttle -> verify initial `<VideoGridSkeleton />` and `<WatchPageSkeleton />` mount with zero Cumulative Layout Shift (`CLS < 0.05`) before hydration.

2. **Security & Vulnerability Audit Suite**:
   - **XSS Attack Vector Fuzzing:** Automated injection of malicious payloads (`<script>`, `onerror=alert(1)`, `javascript:`) in video titles, descriptions, playlist names, and comments; asserts 0 script execution and sanitized DOM rendering.
   - **RBAC/ABAC Privilege Escalation Testing:** Normal user attempts to execute creator actions on another user's video (PATCH `/v1/creator/videos/:id`), access another user's private playlist, or execute admin actions (DELETE `/v1/admin/categories/:id`); asserts 403 Forbidden with RFC 9457 Problem Details.
   - **CORS & Security Headers Check:** Verifies CSP (Content-Security-Policy), HSTS, X-Frame-Options: DENY, X-Content-Type-Options: nosniff, and restricted CORS preflight behavior.

3. **Performance & Core Web Vitals Gate**:
   - Automated headless Lighthouse audit running in CI:
     - Home feed LCP < 1.8s, CLS < 0.05, INP < 100ms.
     - Video watch page LCP < 2.0s with zero layout shift during player mounting.
     - Production bundle analyzer asserts initial client bundle <= 120 KB gzipped.

4. **Resilience & Offline Validation**:
   - Simulates offline drop mid-browse: verifies PWA Service Worker serves cached feed and queues background sync comment mutations cleanly.

## Acceptance criteria

- [ ] Playwright E2E suite installed in `apps/web/e2e/` with test workflows covering Creator, Viewer, Playlists, URL Modals, Search, Admin, Error Resilience, and Visual Skeletons.
- [ ] Command `pnpm test:e2e:fullstack` (or `make e2e-fullstack`) executes all tests against local Docker stack in < 8 minutes.
- [ ] Automated security audit tests:
  - 10 hostile XSS injection payloads sanitized across comments, descriptions, and playlists.
  - 10 privilege escalation boundary tests asserting 403 / 401 across admin, private playlists, and creator endpoints.
  - Strict security response headers verified (Content-Security-Policy, X-Content-Type-Options).
- [ ] Core Web Vitals CI assertions pass:
  - LCP <= 1.8s
  - CLS <= 0.05
  - Performance score >= 90
- [ ] End-to-end playback assertion: Playwright verifies `<video>` element emits playing event and time updates on HLS master stream.
- [ ] Playlist queue assertion: Playwright verifies queue tray renders playlist items and continuous autoplay advances video sequence.
- [ ] URL-driven modal assertion: Playwright verifies search param modal sync, browser Back button modal dismissal, and refresh durability.
- [ ] Offline resilience assertion: Playwright simulates network disconnect, verifies offline banner renders, and background sync queues mutation.
- [ ] Error routing assertion: Invalid URLs display custom 404 page; transient server hiccups auto-retry and recover.
- [ ] Skeleton visual stability assertion: Playwright captures cold-load frames, asserting layout coordinates match rendered content (`CLS < 0.05`).

## Out of scope

- Multi-region distributed load testing (covered in backend ticket 28).

## Notes for the implementer

- Run Playwright in headless Chromium mode with `--disable-gpu` for fast, reproducible CI execution.
- Seed predictable test fixtures using `pnpm db:seed` before running the test suite.

## Testing plan

- Full suite execution via `make e2e-fullstack`.
- Report generation: HTML test report with trace recordings and failure screenshots in `apps/web/playwright-report/`.

## Definition of Done

- [ ] `make e2e-fullstack` passes with 100% green tests.
- [ ] Security, Playlist, Error Resilience, and Core Web Vitals assertions verified.
- [ ] Ticket status set to `done` and `python docs/tickets/gen-index.py` re-run.
