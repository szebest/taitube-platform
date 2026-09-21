# AGENTS.md — @vp/worker (BullMQ Processing Workers)

Instructions for any coding agent working on the Taitube distributed worker runtime (`apps/worker`).

---

## 1. Scope & Architecture

`apps/worker` executes asynchronous BullMQ processing stages across the video ingestion and transcoding pipeline.
- **Composition Root:** `apps/worker/src/runner.ts` wires stage processors with concrete or in-memory adapters.
- **Stage Registry:** The active processing stage is selected by the `WORKER_STAGE` environment variable (`probe`, `transcode-1080p`, `transcode-720p`, `transcode-480p`, `thumbnail`, `package`, `notify`).

---

## 2. Invariants & Rules

### Rule 1: Dual-Runtime Compatibility (Strict Parity)
- Worker code must run identically under **Node.js 24 LTS** and **Bun 1.4+**.
- Worker source files must import exclusively from Node.js standard libraries (`node:fs`, `node:path`, `node:os`, `node:child_process`).
- **Strictly Forbidden:** Importing or using `Bun.*` proprietary APIs.
- All worker tests must pass under both `vitest` and `bun test`.

### Rule 2: Fencing Tokens & CAS State Transitions
- Processing steps claim a unique UUIDv7 `lock_token` via `claimStep`.
- Step completions verify `lock_token` via `completeStep` to reject zombie workers if a job was re-queued.
- State transitions on `videos` execute via Compare-and-Set and atomically log audit records in `video_events`.

### Rule 3: Bounded Temp File Cleanup
- All FFmpeg file processing occurs inside `os.tmpdir()` subdirectories.
- Handlers must use `finally` blocks to guarantee temporary files are unlinked on both success and error paths to prevent disk leaks.

### Rule 4: Graceful Shutdown & Liveness
- Handle `SIGTERM` and `SIGINT` to allow active transcoding jobs to finish or abort cleanly within bounded timeouts.
- Periodically touch the heartbeat file (`WORKER_HEARTBEAT_PATH`) to prevent watchdog kills.

---

## 3. Dedicated Skills & References

- **`worker-pipeline-stages`**: Pipeline stage design, FFmpeg invocations, and fencing token flow.
- **`vp-bullmq-pipeline`**: BullMQ 6 topology, stalled jobs, retry policies.
- **`vp-ffmpeg-hls-ladder`**: FFmpeg command construction, keyframe alignment, HLS packaging.
- **Testing Standards:** `docs/standards/testing.md`.

---

## 4. Local Commands

```bash
# Run probe stage under Node
WORKER_STAGE=probe pnpm --filter @vp/worker dev

# Run transcode stage under Bun
WORKER_STAGE=transcode-720p bun apps/worker/src/main.ts

# Run tests under Vitest (Node)
pnpm --filter @vp/worker test

# Run tests under Bun
pnpm --filter @vp/worker test:bun
```
