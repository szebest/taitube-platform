# 33: Cost guardrails and runbooks — budget alerts, retention, five operator runbooks

| Field | Value |
|---|---|
| Phase | 4 — Resilience & cloud |
| Issue | [#33](https://github.com/szebest/taitube-platform/issues/33) |
| Size | S–M |
| Blocked by | 32 — Cloud deployment · 24 — Alert rules |
| Blocks | — |
| Spec | [PRD §11 Risks (egress, Class A ops, free tiers)](../PRD.md#11-risks-mitigations) · [SDD §12.3 guardrails paragraph](../SDD.md#123-rung-3-cloud-reference-deployment-phase-4) · [SDD §13.5 `R2ClassABudget`](../SDD.md#135-dashboards-alerts-committed-under-observability) · [SDD §15.1 `docs/runbooks`](../SDD.md#151-repository-layout-monorepo-video-pipeline) |

**Status:** done

## What to build
Running the reference deployment can never surprise you with a bill: the R2 Class-A projection alert, Neon compute-hour and Grafana series usage panels, raw-source retention and generation purge are verified in the cloud, and five runbooks (`dlq-replay`, `queue-paused`, `worker-stuck`, `storage-outage`, `cost-budget`) tell a future operator (or agent) exactly what to do when each alert fires, with the commands to run.

## Acceptance criteria
- [x] `R2ClassABudget` fires in a test by lowering the threshold; Storage & Cost dashboard shows Class A/B ops, Neon CU-h (from Neon API or manual panel), Grafana Cloud series count.
- [x] Raw retention and generation purge observed in R2 (objects disappear after the configured windows).
- [x] Each runbook: trigger, dashboards to open, diagnosis steps, remediation commands (`kubectl`, Bull Board actions, admin API calls), verification, and "how to prevent next time"; each alert's `runbook_url` resolves.
- [x] A dry run: hand `worker-stuck.md` to someone/an agent with no context and they resolve a simulated stuck job.

## Out of scope
Billing automation.

## Notes for the implementer
- Keep runbooks short and command-first; link to SDD sections rather than repeating theory.

## Testing plan
Alert threshold test; runbook dry run recorded in PR.

## Open questions
- None.

## Definition of Done
- [x] Five runbooks merged; alerts link to them; PRD §11 mitigations marked implemented.
