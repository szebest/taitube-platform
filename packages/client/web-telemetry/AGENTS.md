# AGENTS.md - @vp/web-telemetry (real-user vitals and browser traces)

> Tier rules for this directory: [../AGENTS.md](../AGENTS.md) · full tier & layer reference: [packages/AGENTS.md](../../AGENTS.md) · spec: [SDD §13.1, §13.3](../../../docs/SDD.md#13-autoscaling--observability)

Owner: ticket [64](../../../docs/tickets/64-web-vitals-monitoring-inp-lcp-cls-real-user-measurement.md).
`client` tier, layer T4 (it depends on `@vp/api-contracts`, T3, and `@vp/result`).

## What it holds

- `useWebTelemetry({ app, apiBaseUrl, tracesUrl })`, called once from each client app's root route. After
  hydration its effect loads the two modules below with dynamic imports, so neither reaches the server
  render or the entry chunk.
- `start-web-vitals.ts`: `web-vitals` (`onLCP`, `onINP`, `onCLS`, `onFCP`, `onTTFB`) into one queue per
  page (`vitals-queue.ts`), each vital tagged with the TanStack Router route id the page is on, never the
  URL. The queue flushes on `visibilitychange` to hidden and on `pagehide`, through `navigator.sendBeacon`
  with a `fetch` `keepalive` retry (`send-vitals.ts`), to `POST /v1/telemetry/vitals`.
- `start-web-tracing.ts`: `@opentelemetry/sdk-trace-web` with the fetch instrumentation. `traceparent`
  goes to the API origin and the page's own origin only; spans export over OTLP/HTTP to `tracesUrl`.
  `drop-url-query.ts` strips the query string from every span's URL.

## Rules

- **No host literal here.** Each app's `src/config` owns its API and collector defaults, both local.
- **The beacon is not an API client call.** `sendBeacon` cannot go through `@vp/api-client`; the path
  comes from `recordWebVitals` in `@vp/api-contracts`, so it cannot drift from the route.
- **No user data in a span.** No user id, no session, no query string.

```bash
pnpm --filter @vp/web-telemetry typecheck
pnpm --filter @vp/web-telemetry test
```
