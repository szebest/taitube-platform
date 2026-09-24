# AGENTS.md — @vp/observability (Prometheus & OpenTelemetry)

Instructions for any coding agent working on `@vp/observability`.

> Tier rules for this directory: [../AGENTS.md](../AGENTS.md) · full tier & layer reference: [packages/AGENTS.md](../../AGENTS.md)
---

## 1. Scope & Purpose

`@vp/observability` provides the shared metrics and tracing for the API and the workers. Logging is not
here: it lives in [`@vp/logger`](../logger/AGENTS.md), and this package neither re-exports it nor imports
`pino` (`zero-matches.test.ts`).
- **Prometheus Metrics:** Standard RED metrics (Rate, Errors, Duration) for HTTP endpoints, BullMQ queue depth gauges, transcode real-time factor, and storage throughput.
- **OpenTelemetry Tracing:** Distributed trace propagation spanning API request handlers, Redis queues, and BullMQ worker job executions.

---

## 2. Invariants

- Telemetry must remain local-first: no-op if OTLP endpoints are unconfigured.
- Never log sensitive authentication tokens, passwords, or PII.

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
