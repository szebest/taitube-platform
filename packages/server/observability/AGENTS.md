# AGENTS.md — @vp/observability (Prometheus, OpenTelemetry & Logging)

Instructions for any coding agent working on `@vp/observability`.

> Tiers, layers and the import rules in full: [docs/standards/package-boundaries.md](../../../docs/standards/package-boundaries.md)
---

## 1. Scope & Purpose

`@vp/observability` provides the shared telemetry infrastructure for API servers and workers:
- **Pino Structured Logger:** High-performance JSON logger with redaction, request correlation IDs, and stage tagging.
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
- **`pino-logging`**

---

## 4. Local Commands

```bash
pnpm --filter @vp/observability typecheck
pnpm --filter @vp/observability test
```
