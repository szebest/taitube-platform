# 64: Core Web Vitals real-user measurement (LCP, INP, CLS) and OpenTelemetry web traces

| Field | Value |
|---|---|
| Phase | 5 — Developer experience & growth |
| Issue | [#64](https://github.com/szebest/taitube-platform/issues/64) |
| Size | M |
| Blocked by | 89 - TanStack Start foundation · 91 - Web import aliases |
| Blocks | 65 |
| Spec | [SDD §13 Observability](../SDD.md#13-autoscaling--observability) · [SDD §6.1 Endpoints](../SDD.md#61-endpoints) |

**Status:** blocked

Measurement only. The optimisations (poster preload, `fetchpriority`, aspect-ratio
placeholders, `startTransition`) belong to the page tickets that render those elements and to
[66](66-advanced-code-splitting-dynamic-chunking-lazy-loading.md); this ticket makes their effect visible.

## What to build

1. **RUM beacon.** `web-vitals` (`onLCP`, `onINP`, `onCLS`, `onFCP`, `onTTFB`) in `apps/web/src/features/telemetry/`,
   started from the root route on the client only, batched and sent with `navigator.sendBeacon` (or
   `fetch` with `keepalive`) to `POST /v1/telemetry/vitals`, tagged with the route id rather than the URL.
2. **Vitals endpoint.** `POST /v1/telemetry/vitals` in `apps/api`, contract in `@vp/api-contracts`, exporting
   histograms to Prometheus (`frontend_lcp_seconds`, `frontend_inp_seconds`, `frontend_cls_ratio`,
   `frontend_ttfb_seconds`) by route, plus a Grafana panel row.
3. **Web traces.** `@opentelemetry/sdk-trace-web` with fetch instrumentation propagating `traceparent`, so a
   page load links to the Fastify and worker traces from [23](23-otel-tracing-e2e.md). Exported to the local
   collector; no user data in span attributes.
4. **Lighthouse report.** A local Lighthouse CI run against the built app that reports LCP, CLS and the
   performance score in the PR. Thresholds are recorded but not enforced until the page tickets land.

## Acceptance criteria

- [ ] Loading a page sends one beacon batch with the vitals the browser reported, tagged by route id.
- [ ] `POST /v1/telemetry/vitals` validates the batch, rejects oversized bodies, and the metrics appear in
      Prometheus.
- [ ] A browser fetch to the API carries `traceparent`, and Tempo shows the browser span as the parent of the
      API span.
- [ ] Lighthouse CI runs against the local build with no off-machine requests and prints its report.
- [ ] Nothing in this ticket loads in the server render or blocks hydration.

## Out of scope

- Third-party analytics (Google Analytics, Mixpanel).
- Playback QoS telemetry: [65](65-first-party-video-playback-telemetry-analytics-beacon.md).

## Testing plan

- Unit spec for the batching and route tagging with a mocked `sendBeacon`.
- API integration test for the vitals endpoint and the exported metrics.

## Definition of Done

- [ ] `pnpm --filter @vp/web test`, `pnpm test`, `pnpm typecheck`, `pnpm lint` green; `make smoke-offline` passes.
- [ ] `docs/SDD.md` §6.1 and §13 list the endpoint and metrics.
- [ ] Ticket status set to `done` and `python3 docs/tickets/gen-index.py` re-run.
