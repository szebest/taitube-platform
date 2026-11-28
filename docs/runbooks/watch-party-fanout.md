# Runbook: Watch Party Fan-out Slow

## 1. Overview
Room frames (state, chat, roles, roster) take more than 250 ms from being published to being written to a socket on a pod, at the 95th percentile.

---

## 2. Trigger Alert
- **Alert Name**: `WatchPartyFanoutSlow`
- **Expression**: `histogram_quantile(0.95, sum(rate(watch_party_fanout_seconds_bucket[5m])) by (le)) > 0.25`
- **Severity**: `warning`
- **Duration**: `10m`

---

## 3. Dashboards to Open
- **Watch parties dashboard**: `/d/vp-watch-parties`, panel "Fan-out p50 and p95" and "Room sockets per pod".
- **API dashboard**: `/d/api`, in-flight requests and latency.

---

## 4. Diagnosis & Remediation Steps
1. Check whether one pod holds most sockets (`watch_party_sockets` by instance). A pod far above the others is the slow one: scale the API or restart it so members reconnect and spread.
2. Check Redis latency (`redis-cli --latency`). Every room frame is a pub/sub publish, so a slow Redis slows every pod.
3. Check the pods' CPU. Reactions and roster changes batch per window, so a burst from a very large room costs one frame, not one per sender; a sustained rise means more rooms, not a bug.
4. If it follows a deploy, compare against the previous version and roll back.
