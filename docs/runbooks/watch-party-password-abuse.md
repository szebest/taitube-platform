# Runbook: Watch Party Password Brute Force

## 1. Overview
Joins refused for a wrong or locked room password are sustained above one per second. The 6th failure in 15 minutes locks a member key and an IP, so a rate this high means many keys or addresses, or a script.

---

## 2. Trigger Alert
- **Alert Name**: `WatchPartyPasswordBruteForce`
- **Expression**: `sum(rate(watch_party_joins_total{outcome=~"password_invalid|locked"}[5m])) > 1`
- **Severity**: `warning`
- **Duration**: `5m`

---

## 3. Dashboards to Open
- **Watch parties dashboard**: `/d/vp-watch-parties`, panel "Joins by outcome".

---

## 4. Diagnosis & Remediation Steps
1. Split by kind: `sum by (kind) (rate(watch_party_joins_total{outcome="password_invalid"}[5m]))`. Mostly `guest` points at a scripted client; mostly `user` at credential stuffing with accounts.
2. Find the rooms in the API logs (refused joins count in the metrics, not one log line each, so look for the `watch_party.join` spans with the password outcome in Tempo).
3. The locks already hold per member key and per IP; no action is needed to stop guessing. To end it, ask the owner of the targeted room to change the password, or close the room (`POST /v1/watch-parties/:id/close` as a platform moderator).
4. If the source is one network, block it at the edge.
