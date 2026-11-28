# Runbook: Watch Party Clock Skew

## 1. Overview
A pod's wall clock differs from Postgres `clock_timestamp()` by more than 100 ms. The room clock is the pod's wall clock, so members on different pods see positions that disagree by that much.

---

## 2. Trigger Alert
- **Alert Name**: `WatchPartyClockSkew`
- **Expression**: `max(abs(watch_party_clock_skew_seconds)) > 0.1`
- **Severity**: `warning`
- **Duration**: `5m`

---

## 3. Dashboards to Open
- **Watch parties dashboard**: `/d/vp-watch-parties`, panel "Hard seeks and clock skew".

---

## 4. Diagnosis & Remediation Steps
1. Find the pod: `watch_party_clock_skew_seconds` has one series per pod (`instance`).
2. On a node, check time sync (`chronyc tracking` or `timedatectl status`). In Kubernetes check the node, not the container.
3. On a laptop running compose, a sleep and wake leaves the VM clock behind; restart the Docker VM or run its clock sync.
4. Replace the pod on a healthy node if the node cannot be fixed quickly. The sweep samples the skew every minute, so the alert clears within a few minutes of the fix.
