# AGENTS.md — @vp/job-contracts (BullMQ Job Schemas & Queue Topology)

Instructions for any coding agent working on `@vp/job-contracts`.

---

## 1. Scope & Purpose

`@vp/job-contracts` is the single source of truth for queue names, deterministic job ID generation, job payload Zod schemas, and stage retry strategies.
- **Queue Names:** `probe`, `transcode-1080p`, `transcode-720p`, `transcode-480p`, `thumbnail`, `package`, `notify`, `dlq`.
- **Deterministic Job IDs:** Formatted as `<stage>:<videoId>:<generation>` (e.g. `probe:018f...:1`).
- **Flow Hierarchy:** Parent-child job flows orchestrated via BullMQ `FlowProducer`.

---

## 2. Invariants

- Adding or altering queue names or job schemas requires updating `docs/SDD.md` §9 and §20 in the same PR.
- Retry backoffs are configured here: exponential backoff with jitter and max attempt counts.

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
