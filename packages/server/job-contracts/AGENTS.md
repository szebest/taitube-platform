# AGENTS.md — @vp/job-contracts (BullMQ Job Schemas & Queue Topology)

Instructions for any coding agent working on `@vp/job-contracts`.

> Tier rules for this directory: [../AGENTS.md](../AGENTS.md) · full tier & layer reference: [packages/AGENTS.md](../../AGENTS.md)
---

## 1. Scope & Purpose

`@vp/job-contracts` is the single source of truth for queue names, job ids, job payload and result
schemas, stage retry policies and the rendition ladder. Tier `server`, `vp.layer` 1; its only dependency
is `zod`.

- **Queue names (`QUEUES`):** `probe`, `transcode-1080p`, `transcode-720p`, `transcode-480p`, `thumbnail`,
  `package`, `notify`, `housekeeping`, `dlq`.
- **Payloads:** `ProbeJob`, `TranscodeJob`, `ThumbnailJob`, `PackageJob`, `NotifyJob`, `HousekeepingJob`,
  `DlqJob`. Results: `TranscodeResult` and `ThumbnailResult`, told apart by `type` in the
  `ChildResult` discriminated union a package job reads back from its flow children.
- **Deterministic job ids (`ids`):** probe, thumbnail and package are `<videoId>--<stage>--g<generation>`, a
  transcode adds the rendition (`<videoId>--transcode--720p--g1`), notify is
  `<videoId>--notify--<event>--<seq>` and a DLQ entry `<queue>--<jobId>--a<attempt>`; a replay appends
  `--r<n>` (`generateReplayJobId`).
- **Ladder (`src/ladder.ts`):** `RENDITIONS`, `RenditionName`, `LadderEntry` and `CANONICAL_LADDER`
  (tallest first), which `satisfies readonly LadderEntry[]`. No other package defines rungs.

---

## 2. Invariants

- Adding or altering queue names or job schemas requires updating `docs/SDD.md` §9 and §20 in the same PR.
- Retry policies live in `src/policies.ts`: `stagePolicies` (exponential backoff with jitter and an
  attempt count per stage, fixed backoff for `housekeeping`) and `defaultJobOptions`, read by the API and the
  worker when they enqueue. The BullMQ flows themselves are built in `apps/worker`.

---

## 3. Dedicated Skills

- **`vp-bullmq-pipeline`**: BullMQ pipeline architecture and concurrency.
- **`bullmq`**: BullMQ core API reference.

---

## 4. Local Commands

```bash
pnpm --filter @vp/job-contracts typecheck
pnpm --filter @vp/job-contracts test
```
