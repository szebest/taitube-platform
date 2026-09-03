
## Suggested single-developer order

01 → 02 · 03 → 04 → 05 → 06 → 07 → 08 → **35** (offline proof) → 09 · 10 → 12 → 13 · 14 · 15 · 11 → 16 → 17 → 18 · 19 → 20 → 21 → 22 · 23 → 24 → 25 → 26 · 27 → 28 → 31 (any time) → 29 · 30 → 32 → 33 → 34 (after 2026-10-28).

## Phase exits

| Phase | Exit ticket(s) | Tag |
|---|---|---|
| 0 Bootstrap | 01, 02, 03 | `phase0-start` |
| 1 Walking skeleton | 08 + 35 (and 09) | `phase1-done` |
| 2 Real pipeline | 20 | `phase2-done` |
| 3 Observe & scale | 26 + 28 | `phase3-done` |
| 4 Resilience & cloud | 29 + 32 + 33 | `phase4-cloud` |

## Backlog (Phase 5, not ticketed yet — see SDD §18 Phase 5)

| Candidate | Spec pointer | Would be blocked by |
|---|---|---|
| Chunked parallel transcoding (split at keyframes, transcode chunks concurrently, concat) | [SDD §8.5](../SDD.md#85-chunked-parallel-transcoding-phase-4-stretch-designed-not-built), [ADR-08](../SDD.md#adr-08-transcode-parallelism-one-job-per-rendition-fan-out-chunked-transcoding-as-stretch) | 14, 28 |
| CMAF/fMP4 segments + DASH manifest from one segment set | [ADR-07](../SDD.md#adr-07-delivery-format-hls-with-mpeg-ts-segments-mvp-cmaffmp4-upgrade-path) | 12 |
| `apps/worker-go` sibling consuming the same queues | [ADR-01](../SDD.md#adr-01-primary-language-runtime-typescript-node-lts-api-bun-workers), [ADR-11](../SDD.md#adr-11-repository-topology-modular-monorepo-multiple-deployables-one-worker-image) | 20 |
| RabbitMQ implementation of the same topology (comparative write-up) | [ADR-03](../SDD.md#adr-03-message-broker-bullmq-6-on-redis-task-queue-with-postgres-video_events-as-the-append-only-log) | 20 |
| Signed playback URLs / private videos via CDN | [PRD OQ-2](../PRD.md#12-open-questions-to-resolve-during-phase-01) | 32 |
| Redpanda tail of `video_events` for a search indexer | [ADR-03 hybrid verdict](../SDD.md#adr-03-message-broker-bullmq-6-on-redis-task-queue-with-postgres-video_events-as-the-append-only-log) | 30 |
| Frontend integration with `youtube-frontend` (upload widget, SSE progress, hls.js player using `SseEvent` types) | [PRD §1](../PRD.md#1-summary) | 19, 15 |

## Ticket template

```markdown
# NN: <Title — the behaviour it makes work>

| Field | Value |
|---|---|
| Phase | <0–4 — name> |
| Size | S / M / L |
| Blocked by | <NN — short title, …> or None (can start immediately) |
| Blocks | _auto_ |
| Spec | [PRD …](../PRD.md#…) · [SDD …](../SDD.md#…) |

**Status:** ready-for-agent

## What to build
End-to-end behaviour from the user's/operator's perspective — not a layer list.

## Acceptance criteria
- [ ] …

## Out of scope
## Notes for the implementer   (decision-rich only; no file paths that go stale beyond the package names fixed in SDD §15.1)
## Testing plan
## Open questions
## Definition of Done
```
