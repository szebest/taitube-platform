# 21: Local observability stack — Prometheus, Grafana, Tempo, Loki, OTel collector as a compose profile

| Field | Value |
|---|---|
| Phase | 3 — Observe & scale |
| Issue | [#21](https://github.com/szebest/taitube-platform/issues/21) |
| Size | M |
| Blocked by | 08 — Containerise + compose |
| Blocks | 22, 23 |
| Spec | [SDD §12.1 observability profile](../SDD.md#121-rung-1-docker-compose-local-dev-phase-02) · [SDD §13.3–13.5](../SDD.md#133-tracing-opentelemetry) · [ADR-14](../SDD.md#adr-14-observability-stack-opentelemetry-prometheus-grafana-tempo-loki-grafana-cloud-free-in-cloud) · [SDD §16.7 env](../SDD.md#167-observability) |

**Status:** done

## What to build
`docker compose --profile observability up` adds Prometheus (scraping API and every worker's metrics port), Grafana (datasources for Prometheus, Tempo, Loki provisioned; dashboards folder mounted), Tempo, Loki and an OTel collector receiving OTLP/HTTP from the apps and forwarding logs to Loki. Opening Grafana shows the API's default Node metrics and the workers' process metrics; the collector accepts traces (real spans arrive in 23).

## Acceptance criteria
- [x] Profile starts in < 60 s; Prometheus targets page shows `api` and each `worker-*` `UP`.
- [x] Grafana at `:3001` has the three datasources healthy and an empty "video-pipeline" dashboards folder wired to `observability/dashboards/`.
- [x] Sending a test OTLP span (`otel-cli` or a script) shows up in Tempo; a pino line from the API is queryable in Loki with `{service="vp-api"}`.
- [x] Alertmanager present (rules folder mounted, empty) with a Discord/Telegram webhook receiver configured from env.

## Out of scope
Metric content (22), traces from apps (23), rules (24).

## Notes for the implementer
- Workers expose metrics on their own port; compose needs distinct host ports or Prometheus scraping by service name on the compose network (preferred).

## Testing plan
Manual + a `make obs-check` script asserting targets `UP` via the Prometheus API.

## Open questions
- Grafana Alloy vs otel-collector locally: collector locally (matches SDD), Alloy in the cloud (32).

## Definition of Done
- [x] Profile documented in README "Observability".
