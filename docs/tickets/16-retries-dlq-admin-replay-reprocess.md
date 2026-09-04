# 16: Retries with backoff, Dead-Letter Queue with Postgres mirror, admin replay/discard, re-process with generations

| Field | Value |
|---|---|
| Phase | 2 — Real pipeline |
| Size | L |
| Blocked by | 12 — Flows fan-out/fan-in · 10 — Bull Board + admin auth |
| Blocks | 20, 30 |
| Spec | [PRD US-8, US-9, US-14](../PRD.md#5-user-stories-acceptance-criteria) · [PRD FR-9, FR-10](../PRD.md#6-functional-requirements) · [SDD §9.6 Failure handling (diagram + rules)](../SDD.md#96-failure-handling-retries-dlq-poison-pills) · [SDD §9.1 policies](../SDD.md#91-queue-topology) · [SDD §9.2 generations](../SDD.md#92-job-identity-payload-contracts) · [SDD §5.2 `dlq_entries`](../SDD.md#52-ddl-drizzle-migration-0001-authoritative-excerpt) · [SDD §6.1 Admin endpoints](../SDD.md#61-endpoints) · [ADR-18](../SDD.md#adr-18-error-taxonomy-decides-retry-policy) |

**Status:** done

## What to build
Stop MinIO for 60 s while videos are transcoding: jobs fail transiently, retry with exponential backoff + jitter, and every video still reaches `READY`. Stop it for 15 min: jobs exhaust their attempts, land in the `dlq` queue **and** in `dlq_entries`, the rendition/video flip to `FAILED`, and `notify` publishes `video.failed`. An operator lists DLQ entries (`GET /admin/dlq`), inspects one, replays it (fresh attempt counter, audited) or discards it. An owner or admin can `POST /videos/:id/reprocess`, which bumps the video's *generation* so a fresh Flow runs without colliding with the old job ids, writing into a new HLS generation prefix and swapping `master_playlist_key` atomically. Optional: HMAC-signed webhook per user on terminal events.

## Acceptance criteria
- [x] Stage policies from SDD §9.1 are applied from `packages/job-contracts` (attempts, exponential delay, `jitter`); observed retry delays for a transcode: ≈10/20/40 s ± jitter (log timestamps in test).
- [x] `PermanentError` → no retry, DLQ on attempt 1; `TransientError` → DLQ after `attempts`; unknown errors → treated transient with cap 3.
- [x] `worker.on('failed')` handler: inserts `dlq_entries` (unique per queue/job/attempt), adds a `DlqJob` copy to the `dlq` queue, marks `processing_steps DEAD`, `renditions FAILED`; with `failParentOnFailure` the parent fails and the video becomes `FAILED` exactly once with the first child's code; `video.failed` published.
- [x] `GET /admin/dlq?cursor=` paginates from Postgres; `POST /admin/dlq/:id/replay` re-adds to the origin queue with id suffix `--r{n}`, marks `REPLAYED`, appends `dlq.replayed`; `DELETE` marks `DISCARDED`. Both admin-only and audited.
- [x] `POST /videos/:id/reprocess` (owner rate-limited 5/min, or admin) → generation `g2`, new job ids, outputs under `hls/g2/`, `master_playlist_key` switched after `READY`; old generation scheduled for purge (17).
- [x] Alerting hook: a counter/log line `dlq_entries_total{queue,error_code}` increments (metric wiring finalised in 22).
- [x] Hostile fixture set: every file ends in DLQ with the expected code and `attemptsMade = 1`.
- [x] Optional webhook: HTTPS-only, `X-Signature` HMAC with timestamp, `Idempotency-Key = jobId`, SSRF guard against private ranges; disabled unless `WEBHOOK_URL_ALLOWLIST` is set.

## Out of scope
Transactional outbox (30), toxiproxy fault injection (29 — here use `docker stop/start minio`).

## Notes for the implementer
- BullMQ has no native DLQ; this is the documented listener pattern. Keep failed jobs in Redis for 7 days (`removeOnFail.age`) so Bull Board shows them too.
- Circuit runbook (pause the queue when > 50 % fail over 5 min) is documented here; automation is 24.

## Testing plan
Integration with `docker stop minio` sleeps; unit for the failure handler with fake jobs; route tests for admin endpoints; hostile set E2E.

## Open questions
- Replay policy for `PermanentError` entries (e.g. after a codec allowlist change): allow with an explicit `force: true`.

## Definition of Done
- [x] AC green; `docs/runbooks/dlq-replay.md` written; Bull Board shows the `dlq` queue.
