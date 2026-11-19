# AGENTS.md — @vp/pipeline-metrics (The Product's Metrics)

Instructions for any coding agent working on `@vp/pipeline-metrics`.

> Tier rules for this directory: [../AGENTS.md](../AGENTS.md) · full tier & layer reference: [packages/AGENTS.md](../../AGENTS.md)

---

## 1. Scope & Purpose

The metrics the API and the worker record, and the names the product gives its telemetry. The engine
(registry, scrape server, tracing) is [`@kit/observability`](../../platform/server/observability/AGENTS.md).

Tier `server`, `vp.layer` 3 (it depends on `@kit/observability`); its dependencies are in
[package.json](package.json).

- **`src/pipeline-metrics.ts`:** `createPipelineMetrics()` builds the registry with the `vp_` process-metric
  prefix and returns `PipelineMetrics`, one per process; the metric names are catalogued in
  [SDD §13.1](../../../docs/SDD.md#131-metrics-catalogue). The composition root builds it and hands it to
  everything that records. The groups it spreads in: `src/web-vitals-metrics.ts`, `src/playback-metrics.ts`,
  `src/captions-metrics.ts`, `src/screening-metrics.ts`. `createWatchPartyMetrics`
  (`src/watch-party-metrics.ts`) registers the watch-party series on the API's registry.
- **`src/tracer-name.ts`:** `TRACER_NAME`, the instrumentation scope every span of the product is recorded
  under; callers pass it to `getTracer`.

---

## 2. Invariants

- `createPipelineMetrics` and the table in `docs/SDD.md` §13.1 name the same metrics, none missing and none
  extra (`pipeline-metrics.test.ts`). The package's specs also hold the alert rules in
  `infra/observability/alerts/video-pipeline-alerts.yaml` and `infra/compose/alertmanager/alertmanager.yml`.
- A metric name, label, bucket, the `vp_` prefix and `TRACER_NAME` are what dashboards and alerts query:
  changing one is a change to them.

---

## 3. Dedicated Skills

- **`observability-and-instrumentation`**
- **`prometheus`**

---

## 4. Local Commands

```bash
pnpm --filter @vp/pipeline-metrics typecheck
pnpm --filter @vp/pipeline-metrics test
```
