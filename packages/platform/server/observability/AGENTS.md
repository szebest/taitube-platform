# AGENTS.md — @kit/observability (Prometheus Registry, Scrape Server & OpenTelemetry Tracing)

> Tier rules for this directory: [../AGENTS.md](../../../server/AGENTS.md) · full tier & layer reference: [packages/AGENTS.md](../../../AGENTS.md)

---

## 1. Scope & Purpose

The engine of a process's metrics and tracing; it names no product metric, prefix or tracer.

- **Registry (`src/metrics.ts`):** `createMetricsRegistry({ prefix })` returns a `Registry` with the default
  process metrics under `prefix`. The app builds its own metrics on it.
- **Scrape server (`src/server.ts`):** `MetricsServer` serves `/metrics`, `/healthz` and, when given a
  `ready` probe, `/readyz`. Constructing it opens nothing; `listen()` and `close()` return a `Result`.
- **Tracing (`src/tracing.ts`):** `getTracer(name)`, `registeredTracing.shutdown()` and the W3C `traceparent`
  helpers: `getActiveTraceparent`, `extractContextFromTraceparent`, `createTraceparent` and
  `rootTraceparent(tracer, name)`. The tracer name is the caller's.
- **SDK (`src/tracing-sdk.ts`, the `./tracing-sdk` export):** `initTracing` starts the Node SDK with
  auto-instrumentation and an OTLP HTTP trace exporter, from the module a process preloads with
  `--import`. Traces only. `resolveSampler` (`src/sampler.ts`) turns a `TraceSamplerName` and its ratio into
  the SDK sampler.

---

## 2. Invariants

1. **Layer 2, `@kit/result` only.** The OpenTelemetry packages and `prom-client` are peer dependencies; the
   host lists them as dependencies. `@kit/logger` owns logging, not this package.
2. **No product constant here.** The metric prefix and the tracer name are parameters.
3. `initTracing` is a no-op when `enabled` is false. The auto-instrumentation hook wraps third-party
   modules only, never a workspace package or app source.

---

## 3. Dedicated Skills

- **`observability-and-instrumentation`**
- **`prometheus`**
- **`opentelemetry`**

---

## 4. Local Commands

```bash
pnpm --filter @kit/observability typecheck
pnpm --filter @kit/observability test
```
