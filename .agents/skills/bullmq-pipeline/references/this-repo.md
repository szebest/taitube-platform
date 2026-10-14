# This repo

The design is `docs/SDD.md` §9 (pipeline), §20 (contracts code), ADR-03, ADR-16, ADR-18;
when this file and the SDD disagree, check the code, then fix whichever is wrong.

## Topology and identity

- Queues: `probe`, `transcode-1080p`, `transcode-720p`, `transcode-480p`, `thumbnail`,
  `package`, `notify`, `housekeeping`, `dlq`. Three transcode queues so KEDA sizes each
  rendition on its own.
- Separator `--`. Job ids: `${videoId}--probe--g${generation}`,
  `${videoId}--transcode--720p--g${generation}`, `${videoId}--package--g${generation}`,
  notify `${videoId}--notify--${event}--${seq}`, replay suffix `--r${n}`.
- Payloads are zod schemas in `@vp/job-contracts` with a required `traceparent`; options
  come from `stagePolicies` and `defaultJobOptions` in
  `packages/server/job-contracts/src/policies.ts`.

## Flow

`probe` creates the flow: parent `package` with one child per ladder rung on its own queue
plus `thumbnail` (optional). `package` reads the `TranscodeResult`s from
`getChildrenValues()`.

## Workers

- One process per `WORKER_STAGE`; concurrency and lock duration per stage are wired in
  `apps/server/worker/src/composition/stages.module.ts` from the stage policies.
- Stages also write `processing_steps.heartbeat_at` on progress, so a renewing but hung
  FFmpeg is visible (the `WorkerStuck` alert).
- `ioredis` on both Node and Bun (`Bun.redis` is not BullMQ-compatible); Kubernetes grace
  period 900 s for transcodes; `tini` as PID 1.

## Failures

- `PermanentError` and `TransientError` from `@vp/errors`, classified at the throw site
  (root `AGENTS.md`, rule 7).
- Dead letters: a `dlq_entries` row (unique per queue, job and attempts made), a `DlqJob`
  on the `dlq` queue, `processing_steps` marked `DEAD`, the rendition `FAILED`; with
  `failParentOnFailure` the video flips to `FAILED` once and `notify` publishes
  `video.failed`.

## Checks and tools

- `make check-redis` asserts `noeviction` and append-only.
- Bull Board at `/admin/queues` on the API (admin token).
- `video_events` holds each video's history with trace ids; Tempo has the traces.
- The `housekeeping` reconciler re-enqueues `UPLOADED` videos without a probe step after
  five minutes (ADR-16).
