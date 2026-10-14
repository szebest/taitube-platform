---
name: chaos-toxiproxy
description: >-
  Proving resilience claims with small fault scripts and Toxiproxy: kill workers mid-job,
  pause containers as partitions, degrade a dependency, restart the broker, fill the disk,
  then assert effectively-once invariants. Use when a resilience claim needs proof, or when
  adding or changing a fault scenario.
license: MIT
---

# Chaos and resilience checks

Measure, then believe: every resilience claim gets a script that tries to break it and a
checker that says whether it held. Small scripts, no chaos platform. This repo's scripts,
proxy setup and scenarios: `references/this-repo.md`.

## The faults

| Fault | How | What it proves |
| --- | --- | --- |
| Worker crash mid-job | `docker kill -s KILL` or `kubectl delete pod` on a random worker of a stage, every N seconds | stalled detection, re-queue, idempotent redo, temp cleanup |
| Partition | `docker pause` a worker for longer than its lock, then `unpause` | the paused worker is fenced on commit; the fresh attempt wins |
| Slow or broken dependency | Toxiproxy in front of it | retries, backoff, timeouts, the dead-letter path |
| Broker restart | restart Redis mid-run | reconnection, persistence, no lost jobs |
| Full disk | fill the worker's scratch volume | a transient `ENOSPC` error and cleanup |

## Toxiproxy

- Put the proxy on the whole request path the client uses, and point the client's endpoint
  at it for the chaos run; proxy ports sit outside the ephemeral range.
- Toxics: `latency` (with jitter; add it upstream and downstream for a full round trip),
  `bandwidth`, `timeout`, `reset_peer`, `slicer`, `limit_data`. A full outage is the proxy
  disabled, not a toxic. `toxicity` below 1 makes a partial failure.
- Reset between runs (`POST /reset`), so one scenario's toxics never leak into the next.

## Invariants: one reusable checker, run after every scenario

1. Every entity in the run is terminal: done, or failed where the scenario expects it.
2. Exactly one success event per done entity, never two.
3. The object store holds exactly the expected objects per entity, nothing orphaned, and the
   marker object exists if and only if the entity is done.
4. No work row stays running with a stale heartbeat; every fenced attempt is in the logs.
5. The metrics agree: stalled counts above zero when kills happened, dead-letter counts as
   expected, scratch directories empty on every worker.

## A new resilience claim

1. Write the claim as an invariant: a query or an object-store assertion.
2. Choose the smallest fault that could violate it, and script it.
3. Run it five times; record pass or fail, detection time and recovery time.
4. A failure gets a fix and a regression test at the lowest level that reproduces it (unit
   before integration before chaos), and the design doc's failure matrix gains a row.
5. Commit the results with one paragraph of interpretation.

## Gotchas

- A stalled re-queue and a failure retry count attempts differently: read the counters.
- `SIGKILL` leaves no time for cleanup, so a scheduled sweep must remove orphaned temp
  files; assert that it does.
- Compose scale-in stops the newest container, possibly a busy one: a legitimate fault, not
  a bug.
