# Runbook: Watch Party Drift High

## 1. Overview
Members report an absolute drift from the room clock above one second at the 95th percentile. Viewers see people watching different moments and the client keeps hard seeking.

---

## 2. Trigger Alert
- **Alert Name**: `WatchPartyDriftHigh`
- **Expression**: `histogram_quantile(0.95, sum(rate(watch_party_drift_seconds_bucket[5m])) by (le)) > 1`
- **Severity**: `warning`
- **Duration**: `10m`

---

## 3. Dashboards to Open
- **Watch parties dashboard**: `/d/vp-watch-parties`, panels "Drift p50 and p95", "Hard seeks and clock skew" and "Fan-out p50 and p95".

---

## 4. Diagnosis & Remediation Steps
1. Check `WatchPartyClockSkew`. The room clock is the pod's wall clock, so a pod off by more than 100 ms shifts every member it serves. If it fires, follow `docs/runbooks/watch-party-clock-skew.md` first.
2. Compare `histogram_quantile(0.95, sum(rate(watch_party_fanout_seconds_bucket[5m])) by (le))`. Slow fan-out delays `state` frames and shows as drift; follow `docs/runbooks/watch-party-fanout.md`.
3. Look at `sum(rate(watch_party_hard_seeks_total[5m]))`. A rise with flat fan-out points at the members' network or devices, not the platform: nothing to fix server side.
4. Check API CPU and event loop lag for the pods holding the largest rooms (`watch_party_sockets` per pod).
