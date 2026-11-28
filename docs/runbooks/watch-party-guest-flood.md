# Runbook: Watch Party Guest Flood

## 1. Overview
Guest join attempts are sustained above ten per second. Limits are 5 guest credentials per IP per hour and 30 guest joins per room per minute, so a rate this high is mostly refused attempts.

---

## 2. Trigger Alert
- **Alert Name**: `WatchPartyGuestFlood`
- **Expression**: `sum(rate(watch_party_joins_total{kind="guest"}[5m])) > 10`
- **Severity**: `warning`
- **Duration**: `5m`

---

## 3. Dashboards to Open
- **Watch parties dashboard**: `/d/vp-watch-parties`, panels "Joins by outcome" and "Members present by kind".

---

## 4. Diagnosis & Remediation Steps
1. Split by outcome: `sum by (outcome) (rate(watch_party_joins_total{kind="guest"}[5m]))`. `joined` high means a popular room or an invite link shared widely; `full`, `banned` and `guests_off` high means refused traffic.
2. If `joined` is high, check `watch_party_present_members{kind="guest"}` and the API pods' load. A real crowd is capacity planning, not abuse.
3. If it is refused traffic, the limits already hold. The owner of a targeted room can switch off Allow guests, or ban the guests, which also bans their address.
4. If the source is one network, block it at the edge.
