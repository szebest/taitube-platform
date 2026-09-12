# 64: Core Web Vitals optimization & real-user measurement (LCP, INP, CLS & OpenTelemetry web traces)

| Field | Value |
|---|---|
| Phase | 5 — Developer experience & growth |
| Size | M |
| Blocked by | 62 — Frontend performance · 63 — TanStack Router SSR |
| Blocks | 65, 75 |
| Spec | [SDD §13 Observability](../SDD.md#13-autoscaling-observability) · [SDD §6.1 Endpoints](../SDD.md#61-endpoints) |

**Status:** blocked

## What to build

Real user performance in modern web applications is defined by Google's **Core Web Vitals**:
1. **LCP (Largest Contentful Paint):** Target < 1.8s (video poster / hero card).
2. **INP (Interaction to Next Paint):** Target < 100ms (interaction responsiveness on click/seek).
3. **CLS (Cumulative Layout Shift):** Target < 0.05 (prevent layout jumps while loading comments, video ads, or metadata).
4. **TTFB (Time to First Byte):** Target < 200ms.

This ticket delivers real-time frontend performance engineering, RUM (Real User Measurement), and frontend OpenTelemetry tracing:

1. **LCP Optimizations**:
   - `fetchpriority="high"` and `<link rel="preload">` on the primary video poster image.
   - Resource hints (`dns-prefetch`, `preconnect`) for MinIO/S3 CDN storage.
2. **INP (Interaction to Next Paint) Hardening**:
   - Replaces blocking synchronous JavaScript with `React.startTransition` and `scheduler.postTask` during search input filtering and heavy comment list sorting.
   - Passive event listeners on all touch and wheel scrolling handlers.
3. **CLS Elimination**:
   - Enforces strict CSS aspect-ratio placeholders (`aspect-video`, `aspect-[16/9]`) on player skeletons and video thumbnail grids so content never jumps when images load.
4. **RUM Telemetry & OpenTelemetry Web SDK**:
   - Imports `web-vitals` library to capture real-world user metrics (LCP, INP, CLS, FCP, TTFB).
   - Reports Web Vitals via navigator `sendBeacon` to backend endpoint `POST /v1/telemetry/vitals`.
   - Wires `@opentelemetry/sdk-trace-web` linking frontend user clicks to backend Fastify and BullMQ worker traces (Ticket 23).

## Acceptance criteria

- [ ] Video poster images load with `fetchpriority="high"` and preconnect links on watch pages.
- [ ] Video player and thumbnail cards enforce explicit `aspect-video` containers guaranteeing CLS < 0.05.
- [ ] Non-critical state updates (filtering, comment sort) wrapped in `startTransition` to keep INP < 100ms.
- [ ] `web-vitals` integrated capturing metric events (`onLCP`, `onINP`, `onCLS`, `onTTFB`).
- [ ] Endpoint `POST /v1/telemetry/vitals` accepting non-blocking beacon batches and exporting metrics to Prometheus (`frontend_lcp_seconds`, `frontend_inp_seconds`, `frontend_cls_ratio`).
- [ ] Frontend OpenTelemetry span injection correlating browser page loads to backend trace IDs.
- [ ] Automated Lighthouse CI run in GitHub Actions / local asserting:
  - LCP <= 1.8s
  - CLS <= 0.05
  - Performance score >= 92

## Out of scope

- Third-party marketing trackers (Google Analytics, Mixpanel) — keeps platform privacy-focused and GDPR compliant.

## Notes for the implementer

- Use `navigator.sendBeacon` or `fetch` with `keepalive: true` to guarantee telemetry transmits even if user closes tab.
- Do not log sensitive user data in OpenTelemetry frontend spans.

## Testing plan

- Synthetic performance audit: Run Lighthouse audit on desktop and simulated mobile throttling (4G, 4x CPU slowdown); assert all Core Web Vitals are within "Good" green thresholds.
- Telemetry test: Load page, simulate user interaction, assert `POST /v1/telemetry/vitals` receives metric event with correct trace ID.

## Definition of Done

- [ ] Lighthouse score >= 92 across all pages.
- [ ] Real User Monitoring verified against Prometheus dashboard.
- [ ] Architecture and decision docs updated (`ARCHITECTURE.md`, `docs/SDD.md` and ADRs if boundaries, packages or contracts changed).
- [ ] Ticket status set to `done` and `python docs/tickets/gen-index.py` re-run.
