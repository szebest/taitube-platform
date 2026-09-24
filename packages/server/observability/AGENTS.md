# AGENTS.md — @vp/observability (Prometheus & OpenTelemetry)

Instructions for any coding agent working on `@vp/observability`.

> Tier rules for this directory: [../AGENTS.md](../AGENTS.md) · full tier & layer reference: [packages/AGENTS.md](../../AGENTS.md)

---

## 1. Scope & Purpose

`@vp/observability` provides the shared metrics and tracing for the API and the worker. Logging is not
here: it lives in [`@vp/logger`](../logger/AGENTS.md), and this package neither re-exports it nor imports
`pino` (`zero-matches.test.ts`).

Tier `server`, `vp.layer` 2 (it depends on `@vp/result`); its dependencies are in [package.json](package.json).

- **Metrics (`src/metrics.ts`):** `createMetricsRegistry()` returns `PipelineMetrics`, one `Registry` per
  process; the metric names are catalogued in [SDD §13.1](../../../docs/SDD.md#131-metrics-catalogue). The
  composition root builds it and hands it to everything that records.
- **Scrape server (`src/server.ts`):** `MetricsServer` serves `/metrics`, `/healthz` and, when given a
  `ready` probe, `/readyz`. Constructing it opens nothing; `listen()` and `close()` return a `Result`.
- **Tracing (`src/tracing.ts`):** `initTracing` starts the Node SDK with auto-instrumentation and an OTLP
  HTTP trace exporter, from the module a process preloads with `--import`. Traces only: metrics stay with
  Prometheus. `resolveSampler` (`src/sampler.ts`) turns an `OTEL_TRACES_SAMPLER` name, typed
  `TraceSamplerName`, and its ratio into the SDK sampler. `registeredTracing.shutdown()` flushes;
  `getActiveTraceparent`, `extractContextFromTraceparent`, `createTraceparent` and `rootTraceparent` carry
  the W3C `traceparent` that job payloads hold.

---

## 2. Invariants

- Local-first: tracing exports to `OTEL_EXPORTER_OTLP_ENDPOINT`, which defaults to a local collector, and
  `initTracing` is a no-op when `config.otel.enabled` is false (it is under `NODE_ENV=test`).
- The auto-instrumentation hook wraps third-party modules only, never `@vp/*` packages or app source.
- `createMetricsRegistry` and the table in `docs/SDD.md` §13.1 name the same metrics, none missing and
  none extra (`metrics-catalogue.test.ts`). The package's specs also hold the alert rules in
  `infra/observability/alerts/video-pipeline-alerts.yaml` and `infra/compose/alertmanager/alertmanager.yml`.

---

## 3. Dedicated Skills

- **`observability-and-instrumentation`**
- **`prometheus`**
- **`opentelemetry`**

---

## 4. Local Commands

```bash
pnpm --filter @vp/observability typecheck
pnpm --filter @vp/observability test
```
