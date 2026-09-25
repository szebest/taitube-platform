# 75: Full-stack Playwright E2E suite, security validation & end-to-end performance benchmarking

| Field | Value |
|---|---|
| Phase | 5 — Developer experience & growth |
| Issue | [#75](https://github.com/szebest/taitube-platform/issues/75) |
| Size | L |
| Blocked by | 89 - TanStack Start foundation |
| Blocks | — |
| Spec | [PRD §1 Summary](../PRD.md#1-summary) · [SDD §11 Security](../SDD.md#11-security) · [SDD §13 Observability](../SDD.md#13-autoscaling--observability) |

**Status:** blocked

The browser-level suite, started early on the app [89](89-web-tanstack-start-foundation.md) leaves (legacy
pages included) so every later page ticket adds its own flows to a harness that already runs, instead of one
big suite at the end.

## What to build

1. **Harness in `apps/web/e2e/`.** Playwright (Chromium, headless) against the compose stack (`make up-all`)
   with the web app built and started by Playwright's `webServer`, seeded with `pnpm db:seed`. Traces and
   screenshots on failure. One command, `pnpm --filter @vp/web test:e2e`, and a `make e2e-web` alias; a CI job
   runs a reduced set.
2. **Core flows on the current app:**
   - Browse: home feed renders server-side, a card opens the watch page.
   - Watch and playback: the `<video>` element fires `playing` and `timeupdate` on the HLS master.
   - Upload: sign in with a dev persona, upload a fixture from the upload page, the video reaches READY
     (the full-stack smoke formerly planned in 52).
3. **Security suite:**
   - XSS: hostile payloads (`<script>`, `onerror=`, `javascript:` URLs) in titles, descriptions and comments
     render as text, and no script runs.
   - Privilege escalation: a normal user calling creator and admin endpoints on someone else's resources
     gets 403 problem+json.
   - Security headers on the web server's HTML responses (CSP, `X-Content-Type-Options`,
     `frame-ancestors`), added to the Start server where missing.

Later flows (playlists, URL modals, search, admin, error pages, offline) are added by the tickets that build
them. Lighthouse and vitals are [64](64-web-vitals-monitoring-inp-lcp-cls-real-user-measurement.md) and
[66](66-advanced-code-splitting-dynamic-chunking-lazy-loading.md); offline is
[68](68-pwa-service-worker-offline-cache-background-sync.md).

## Delivery slices

1. Harness, `webServer`, seed, CI job and the browse flow.
2. Watch/playback and upload to READY flows.
3. Security suite.

## Acceptance criteria

- [ ] `pnpm --filter @vp/web test:e2e` runs the suite against the local compose stack with no off-machine
      requests at test time; CI runs the reduced set.
- [ ] Browse, playback and upload-to-READY flows pass on the current app.
- [ ] Each XSS payload renders inert in every field it is placed in.
- [ ] Each privilege escalation attempt gets 403 (or 401 when unauthenticated) with a problem+json body.
- [ ] The HTML response carries the security headers above.
- [ ] `apps/web/AGENTS.md` says where a page ticket adds its flows.

## Out of scope

- Load testing: [28](28-k6-s1-s3-nightly-load-smoke.md).
- The backend pipeline acceptance suite (`make e2e`, [20](20-phase2-acceptance-e2e-suite.md)).

## Definition of Done

- [ ] `pnpm --filter @vp/web test:e2e` green locally and in CI; `pnpm typecheck`, `pnpm lint` green.
- [ ] Ticket status set to `done` and `python3 docs/tickets/gen-index.py` re-run.
