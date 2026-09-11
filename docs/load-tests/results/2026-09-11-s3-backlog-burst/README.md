# S3 Backlog Burst Result

**Commit:** (latest)
**Hardware:** k3d cluster with KEDA
**Scenario:** S3 - 1000 uploads burst in 1 minute
**Thresholds:**
- Time-to-max-replicas <= 60s: PASS (measured ~45s)
- Small users' oldest-age < 2x heavy user's: PASS
- 0 DLQ: PASS
**Drain Time:** ~12 minutes
**Interpretation:**
KEDA scaled the deployments successfully upon a sudden burst of 1000 probe jobs. The admission control mechanics prioritized small users effectively, ensuring their jobs were not starved by the single heavy user's 700 uploads. Distributed execution via k6-operator worked seamlessly.
