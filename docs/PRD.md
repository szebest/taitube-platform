# PRD — Video Ingestion & Transcoding Backend ("video-pipeline")

| Field | Value |
|---|---|
| Document | Product Requirements Document (PRD) |
| Version | 1.0 — baseline for PDLC kick-off |
| Date | 2026-09-03 |
| Owner | Mateusz Szebestik (solo builder, acting PM + Principal Architect) |
| Status | **Approved for design** — companion document: `docs/SDD.md` |
| Companion frontend | [szebest/youtube-frontend](https://github.com/szebest/youtube-frontend) (integration is post-MVP) |

---

## 1. Summary

`video-pipeline` is a YouTube-inspired, asynchronous backend that accepts video uploads directly into S3-compatible object storage, transcodes them into a multi-resolution HLS ladder (1080p / 720p / 480p) using a horizontally scalable pool of queue-driven workers, and reports progress to clients in real time. It is built to be **runnable for €0 on a laptop** (Docker Compose, then kind/k3d + KEDA) and **deployable for ≈ €0–6 / month** in the cloud.

The product has two customers with equal weight:

1. **The frontend application** (`youtube-frontend`) which needs a reliable upload → processing → playback API.
2. **The builder's career** — the project must exercise and demonstrate senior-level distributed-systems competence: durable job queues, idempotency, retries/DLQ, autoscaling on queue depth, observability, and distributed load testing. Every design decision in the SDD is therefore recorded with ranked alternatives and a rationale, because *being able to defend the decision* is part of the deliverable.

---

## 2. Problem Statement

Uploading and processing video is the canonical "hard" backend problem: files are large (GBs), processing is CPU-heavy and slow (minutes), failures are common (corrupt files, OOM-killed workers, flaky storage), and users expect live feedback. A naive design — API server receives the bytes, transcodes synchronously, returns when done — falls over at the first concurrent user.

We need a backend where:

- the API server **never touches video bytes** (uploads go straight to object storage via presigned URLs);
- processing is **asynchronous, durable and retryable**, with poison-pill isolation (DLQ);
- **every step is idempotent**, so a crashed worker or a duplicate message never corrupts a video or produces a duplicate;
- worker capacity **scales with queue depth**, down to zero when idle (cost constraint);
- **progress is visible** to the client in real time and to the operator through metrics, traces and logs;
- the whole system can be **load-tested under realistic, adversarial scenarios** and its behaviour proven, not assumed.

---

## 3. Goals & Non-Goals

### 3.1 Goals (MVP)

| ID | Goal | Measure |
|---|---|---|
| G1 | Direct-to-storage uploads (single and multipart) with resumability | API process handles 0 bytes of video payload; 4 GB upload succeeds |
| G2 | Fully asynchronous pipeline: probe → transcode (3 renditions) + thumbnails → package → notify | Video reaches `READY` with a playable `master.m3u8` |
| G3 | Durable, at-least-once job processing with idempotent consumers | Kill any worker mid-job → video still reaches `READY` exactly once, no orphan/duplicate output |
| G4 | Retries with exponential backoff + jitter, DLQ for poison pills, operator replay | Corrupt file lands in DLQ after ≤ 1 attempt; transient S3 outage self-heals |
| G5 | Real-time status to clients via SSE | Client sees `PROCESSING 42 %` updates with ≤ 2 s latency |
| G6 | Queue-depth-driven autoscaling, scale-to-zero | KEDA scales `transcode-1080p` from 0 → N and back on a local kind cluster |
| G7 | Full observability: RED metrics, queue lag, transcode throughput, traces across API → worker | Grafana dashboards + alert rules committed to repo |
| G8 | Distributed load-test suite with documented results | k6 scenarios for upload storm, large file, backlog burst, worker chaos, SSE fan-out |
| G9 | Zero-to-minimal cost | Local: €0. Cloud reference deployment ≤ €6 / month |
| G10 | Career/learning value: modern, industry-standard TypeScript stack with documented trade-offs | Every major choice has an ADR with ranked alternatives (SDD §4) |
| G11 | **Local-first**: the entire system runs on one machine with zero external services or accounts — no cloud storage, no hosted DB, no SaaS auth, no hosted observability — and keeps working with the network unplugged | `make smoke-offline` passes on a compose network with egress blocked; every external account in SDD §15.3 is needed only for the optional cloud rung |

### 3.2 Non-Goals (explicitly out of scope for MVP)

- Frontend work of any kind (post-MVP integration with `youtube-frontend`).
- Live streaming / RTMP ingest / low-latency HLS.
- DRM, watermarking, content moderation, copyright matching.
- Recommendation, search, comments, likes, subscriptions — anything "social".
- Multi-region replication or active-active deployments.
- GPU / hardware-accelerated encoding (NVENC, VideoToolbox) — CPU x264 only.
- AV1 / HEVC renditions (H.264 + AAC only; upgrade path documented in SDD).
- Per-shot / per-scene adaptive encoding (YouTube-style "content-aware encoding").
- Billing, quotas beyond a simple per-user size cap, multi-tenant organisations.

### 3.3 Stretch (Phase 4+, designed for but not built in MVP)

- Chunk-level parallel transcoding (split source at keyframes, transcode chunks concurrently, concatenate).
- CMAF/fMP4 packaging to serve HLS **and** DASH from a single segment set.
- Rewriting the worker tier in Go as a drop-in sibling app (same queue contract).
- Transactional outbox for enqueue-after-commit guarantees.

---

## 4. Users & Personas

| Persona | Needs | Pain today |
|---|---|---|
| **Creator** (end user of `youtube-frontend`) | Upload a video from the browser, close the tab, come back and see it processing/ready. Resume an interrupted 2 GB upload. | Uploads fail on flaky networks; no progress feedback; no idea why a video "failed". |
| **Viewer** | Start playback in < 2 s, adaptive quality on mobile/desktop. | Buffering, single-quality playback. |
| **Operator / SRE** (the builder) | See queue depth, throughput, failures; replay a DLQ job; scale workers safely; deploy for pennies. | Black-box workers, no visibility into "stuck" videos, manual restarts. |
| **Reviewer / Interviewer** | Understand the design in 15 minutes from diagrams, ADRs and dashboards; verify claims via load-test results. | Portfolio projects with no trade-off analysis and no evidence of resilience. |

---

## 5. User Stories & Acceptance Criteria

Format: `US-n` — story — **AC** (acceptance criteria, testable).

### 5.1 Upload

- **US-1** As a Creator I can request an upload for a file and receive a presigned URL so my browser uploads directly to storage.
  **AC:** `POST /v1/uploads` returns `{ videoId, uploadId, strategy: "single" | "multipart", partSize, urls[] , expiresAt }` in < 200 ms p95. The API never receives file bytes (verified by load test: API egress/ingress bytes independent of file size).
- **US-2** As a Creator I can upload a 4 GB file in parallel parts and resume after a network drop.
  **AC:** Multipart with 8–64 MB parts, ≤ 10 000 parts; `GET /v1/uploads/:id` lists already-uploaded parts (ETags) so a client resumes; completes with `POST /v1/uploads/:id/complete`.
- **US-3** As a Creator, if I abandon an upload, it does not cost storage forever.
  **AC:** Incomplete multipart uploads older than 24 h are aborted by a sweeper job **and** a bucket lifecycle rule (belt and braces); video row transitions to `ABANDONED`.
- **US-4** As the Operator I want uploads validated before processing starts.
  **AC:** On complete, the server issues `HEAD` on the object and rejects if size ≠ declared size, size > per-user cap, or content-type not in allowlist. Rejected objects are deleted; video → `REJECTED` with `errorCode`.

### 5.2 Processing

- **US-5** As a Creator my uploaded video is probed and transcoded into 1080p, 720p and 480p HLS renditions without manual action.
  **AC:** After `complete`, status progresses `UPLOADED → PROBING → PROCESSING → READY`. A 10-minute 1080p source produces `master.m3u8`, three rendition playlists, 6-second segments, a poster image and a thumbnail sprite sheet.
- **US-6** As a Creator, a 720p source is not upscaled to 1080p.
  **AC:** Probe computes the ladder: only renditions with height ≤ source height (always include at least the lowest rung). `ladder` stored on the video row.
- **US-7** As a Viewer I can play the video in any HLS-capable player (hls.js, Safari).
  **AC:** `GET /v1/videos/:id` returns `playbackUrl` to `master.m3u8`; segments served with correct MIME types and cache headers; playback verified with hls.js in the dev test page.
- **US-8** As the Operator, a corrupted/unsupported file does not clog the pipeline.
  **AC:** Probe throws `UnrecoverableError` → no retries → job in DLQ → video `FAILED` with human-readable `errorCode` (`UNSUPPORTED_CODEC`, `CORRUPT_CONTAINER`, `DURATION_EXCEEDED`, …).
- **US-9** As the Operator, transient failures heal themselves.
  **AC:** Storage returning 503 for 60 s causes retries with exponential backoff + jitter (5 attempts, 5 s → ~80 s) and the video still reaches `READY`.
- **US-10** As the Operator, a worker crash never causes duplicate or corrupt output.
  **AC:** `kill -9` a transcode worker at 50 %: the stalled job is detected within ≤ 60 s, re-run on another worker, the rendition is produced exactly once (deterministic object keys; overwrite is idempotent); DB shows exactly one `READY` transition; `video_events` shows the retry.

### 5.3 Status & feedback

- **US-11** As a Creator I see live processing progress in my browser.
  **AC:** `GET /v1/videos/:id/events` (SSE) streams `status`, `progress` (% per rendition and overall) and `ready`/`failed` events. First event is a snapshot of current state (so late joiners and reconnects via `Last-Event-ID` never miss the terminal state). Heartbeat comment every 15 s keeps proxies open.
- **US-12** As a Creator I can list my videos with status and thumbnails.
  **AC:** `GET /v1/videos?cursor=&limit=` paginated, filtered to the caller.

### 5.4 Operations

- **US-13** As the Operator I can see queue depth, active workers, throughput, p95 job latency, failure rate and DLQ size on one dashboard.
  **AC:** Grafana dashboard `pipeline-overview.json` in repo; Prometheus alerts: `DLQNotEmpty`, `QueueOldestJobAgeHigh`, `JobFailureRateHigh`, `WorkerStalledJobs`.
- **US-14** As the Operator I can inspect and replay a DLQ job.
  **AC:** Bull Board UI at `/admin/queues` (auth-protected); `POST /admin/dlq/:jobId/replay` re-enqueues with a fresh attempt counter and an audit event.
- **US-15** As the Operator, workers scale with load and cost nothing when idle.
  **AC:** KEDA `ScaledObject` per stage queue; `minReplicaCount: 0`; graceful drain on `SIGTERM` (active job completes or is safely re-queued). Demonstrated on kind locally and on the cloud reference cluster.
- **US-16** As the Operator I can trace a single video's journey across services.
  **AC:** One trace ID from `POST /uploads/:id/complete` through `probe`, `transcode-*`, `package`, `notify`; visible in Grafana Tempo (local) / Grafana Cloud Traces.

---

## 6. Functional Requirements

| ID | Requirement | Priority |
|---|---|---|
| FR-1 | Presigned single-PUT upload for files ≤ 100 MB; presigned multipart for larger files; server-side `HEAD` verification on completion. | Must |
| FR-2 | Upload completion triggers processing via an **explicit client `complete` call** (provider-agnostic). Bucket notifications (MinIO webhook) are an optional accelerator, never the only trigger. A reconciler re-enqueues `UPLOADED` videos with no probe job after 5 min. | Must |
| FR-3 | `probe` stage: ffprobe metadata (container, codecs, duration, resolution, fps, bitrate, rotation), validation, ladder decision. | Must |
| FR-4 | `transcode-{1080p,720p,480p}` stages: H.264 (High profile for 1080p/720p, Main for 480p) + AAC-LC 128 kbps, 6 s segments, 2 s GOP with forced keyframes aligned across renditions, MPEG-TS segments, per-rendition `index.m3u8`. | Must |
| FR-5 | `thumbnail` stage: poster JPEG at 10 % duration (or first non-black frame), 160×90 sprite sheet + WebVTT for scrubbing. Runs in parallel with transcodes. | Should |
| FR-6 | `package` stage (fan-in): waits for all children, generates `master.m3u8` with `BANDWIDTH`, `RESOLUTION`, `CODECS`, verifies every referenced segment exists via `HEAD`/list, flips video to `READY`. | Must |
| FR-7 | `notify` stage: publishes terminal event to Redis Pub/Sub (SSE) and, optionally, to a per-user webhook with HMAC signature. | Must (webhook: Could) |
| FR-8 | SSE endpoint per video and per user (`/v1/me/events`) with snapshot-on-connect and `Last-Event-ID` resume. | Must |
| FR-9 | Retries: exponential backoff with jitter; classified errors (`Transient` vs `Unrecoverable`); max 5 attempts for transient. | Must |
| FR-10 | Dead-letter queue `dlq` with full failure context; admin list/inspect/replay/purge. | Must |
| FR-11 | Idempotency: deterministic job IDs, deterministic object keys, compare-and-set state transitions, unique constraints on `(video_id, step, rendition)`. | Must |
| FR-12 | Stalled-job detection via lock renewal (heartbeat) and re-queue; `maxStalledCount` before failing. | Must |
| FR-13 | Concurrency control: per-stage worker concurrency, per-queue rate limits (notify), per-user max in-flight videos (fairness), job priority by user tier. | Should |
| FR-14 | Video CRUD: create (via upload), read, list (paginated), update metadata (title/description/visibility), soft delete (async purge of objects). | Must (delete: Should) |
| FR-15 | Authentication: JWT bearer (RS256/EdDSA) verified by the API; dev-mode static user; user isolation on every query. | Must |
| FR-16 | Admin surface: Bull Board, DLQ replay, force re-process video, health/readiness endpoints, Prometheus `/metrics`. | Must |
| FR-17 | Object storage abstraction: one S3-compatible client used for MinIO (local) and Cloudflare R2 / Backblaze B2 (cloud), configured purely via env. | Must |
| FR-18 | Synthetic test-video generator (ffmpeg `testsrc2`/`sine`) producing deterministic assets for tests and load tests — no third-party content. | Must |
| FR-19 | **Local-first / offline-capable**: every runtime dependency (Postgres, Redis, object storage, auth issuer, metrics/traces/logs backends) has a local container equivalent started by `make up`; `.env.example` defaults are all-local and work unedited; no component phones home (library telemetry disabled, browser libraries vendored, OTel exporter is a no-op when unset); after a one-time `pnpm install` + image pull the full upload → READY → playback path works with no internet. External providers (R2/B2, Neon, Grafana Cloud, Cloudflare) are exclusively for the optional cloud deployment. | Must |

---

## 7. Non-Functional Requirements & SLOs

Targets are for the **reference hardware**: local dev (8 vCPU laptop) and the cloud reference node (2 vCPU / 4 GB). Numbers marked † are hypotheses to be confirmed and revised by the Phase 3 load tests — the point of the load tests is to replace guesses with measurements.

| Category | Requirement / SLO |
|---|---|
| **Performance – API** | Control-plane endpoints p95 < 200 ms, p99 < 500 ms at 500 concurrent VUs. `POST /uploads` never proportional to file size. |
| **Performance – processing** | Time-to-first-playable (480p ready) ≤ 1.5× source duration†; full ladder ≤ 5× source duration† on one 2-vCPU worker for ≤ 10-min 1080p sources. Transcode realtime factor per rendition tracked as a metric. |
| **Performance – SSE** | Event delivery latency (worker publish → client receive) p95 < 2 s; 5 000 concurrent SSE connections per API instance with < 512 MB RSS†. |
| **Scalability** | Horizontal: N workers per stage, no shared local state. Queue backlog of 1 000 probe jobs drains without errors; KEDA reaches target replicas within 60 s of backlog appearing. |
| **Reliability** | At-least-once delivery + idempotent consumers = effectively-once outcomes. Zero lost videos on worker/Redis/API restart. DLQ rate < 0.5 % of jobs under nominal load. |
| **Durability** | Postgres is the source of truth; Redis (queue) is treated as recoverable: a reconciler can rebuild missing jobs from DB state. |
| **Availability** | Single-node reference deployment: best-effort, target 99 % monthly (cost constraint dominates). Design must not preclude HA (stateless API, externalised state). |
| **Cost** | Local: €0. Cloud reference: ≤ €6 / month (one small VPS or Oracle Always Free + R2 free tier + Neon free + Grafana Cloud free). Storage egress must be free-tier (R2 zero egress) — video streaming egress is the #1 cost risk. |
| **Security** | No public write access to buckets; presigned URLs ≤ 15 min TTL; JWT auth; per-user data isolation; HMAC-signed webhooks; secrets only via env/secret manager; containers run non-root; `noeviction` Redis policy. |
| **Observability** | RED metrics for API, queue metrics (waiting/active/delayed/failed/oldest-age per queue), business metrics (transcode seconds/sec, realtime factor, bytes out), OpenTelemetry traces end-to-end, structured JSON logs with `videoId`/`jobId`/`traceId` correlation. |
| **Maintainability** | Monorepo with shared typed contracts (`packages/job-contracts`) — API and workers can never drift on payload shape. ≥ 80 % unit coverage on domain logic; integration tests against real MinIO/Postgres/Redis via Testcontainers. |
| **Portability** | Runs unchanged on Docker Compose, kind/k3d, k3s, and any Kubernetes; storage/DB/Redis swappable via env only. Multi-arch images (amd64 + arm64) for Oracle Ampere / Hetzner CAX. |
| **Local-first** | Zero external services required for development, testing, load testing and demos: everything in the architecture diagram runs in Docker Compose on one laptop, including auth (dev JWKS issuer) and the observability stack. Offline smoke test (`make smoke-offline`) is a CI gate. The only network needs are the initial dependency/image download and the *optional* cloud rung. |
| **Compliance/legal** | Only synthetic or user-owned test content. No third-party copyrighted media in repo or load tests. |

---

## 8. Constraints & Assumptions

**Constraints**

- Solo developer, part-time; velocity matters more than raw runtime performance (drives the TypeScript decision — see SDD ADR-01).
- Zero-to-minimal cost is a hard constraint, not a preference. Any component that cannot run free/cheap is rejected.
- CPU-only transcoding. FFmpeg does the heavy lifting; the application layer is I/O-bound orchestration.
- Cloud free tiers are volatile (Oracle halved its Arm allowance in June 2026; Hetzner raised prices twice in 2026; Fly.io has no free tier). The design must be provider-agnostic so a provider change is an env/Terraform change, not a rewrite.
- **Local-first is non-negotiable**: no ticket may introduce a runtime dependency on an external service without a local container equivalent and an all-local default in `.env.example`. If a capability cannot be provided locally, it is not adopted for the MVP.

**Assumptions**

- Sources are user-generated MP4/MOV/MKV/WebM with H.264/H.265/VP9/AV1 video and AAC/Opus/MP3 audio; anything else is `UNSUPPORTED_CODEC`.
- Max source duration for MVP: 60 minutes; max size: 4 GB (both configurable).
- The frontend will eventually consume: presigned upload flow, video list/detail, SSE events, HLS playback URL.
- Object storage in the cloud is fronted by a CDN (Cloudflare) for playback; the API is never in the playback path.

---

## 9. Success Metrics

| Metric | Target at MVP exit |
|---|---|
| End-to-end demo: upload → READY → playback in hls.js, on Docker Compose, from a fresh clone | `docker compose up` + one script, < 10 min |
| Chaos test suite (worker kill, Redis restart, storage outage) | 100 % pass, results committed under `docs/load-tests/results/` |
| Load-test report | Published for all 6 scenarios with graphs from Grafana |
| Autoscaling demo | Recording/graph of KEDA scaling 0 → N → 0 on queue depth |
| ADR coverage | 100 % of stack decisions documented with ≥ 2 ranked alternatives |
| Cloud reference deployment | Live URL, monthly cost statement ≤ €6 |
| Code quality | CI green: typecheck, lint, unit, integration, container build (multi-arch) |

---

## 10. Release Plan (summary — detail in SDD §18)

| Phase | Theme | Exit criterion |
|---|---|---|
| 0 | Bootstrap | Monorepo, CI, compose skeleton, synthetic test videos |
| 1 | Walking skeleton | Single-PUT upload → probe → one 720p HLS rendition → playable; status by polling |
| 2 | Real pipeline | Multipart, fan-out/fan-in flows, 3 renditions + thumbnails, SSE, retries, DLQ, idempotency, Bull Board |
| 3 | Observe & scale | Prometheus/Grafana/Tempo/Loki, OTel tracing, kind + KEDA, graceful shutdown, k6 scenarios 1–3 |
| 4 | Resilience & cloud | Chaos scenarios 4–6, fencing tokens, reconciler hardening, cloud reference deployment, CDN, cost guardrails; stretch items |

---

## 11. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Free tiers shrink or vanish mid-project | High (observed 3× in 2026) | Medium | Provider-agnostic S3/Postgres/Redis; Terraform/compose per provider; documented fallback ladder (SDD §12) |
| BullMQ is chatty → managed Redis per-command billing (Upstash) explodes | High if Upstash used | High (cost) | Self-host Redis/Valkey next to workers; Upstash only for Pub/Sub if ever |
| Long transcodes exceed lock/visibility windows → duplicate processing | Medium | Medium | Lock renewal (heartbeat), idempotent object keys, fencing token on final commit |
| Worker disk exhaustion (temp segments for 4 GB sources) | Medium | High | Stream-to-storage per segment, ephemeral-storage requests/limits, cleanup on every exit path, disk metric + alert |
| Bun compatibility regressions (child_process stdio, AWS SDK streams) | Medium | Medium | Worker code is runtime-neutral; CI runs worker tests on **both** Bun and Node; `WORKER_RUNTIME` switch in Dockerfile |
| Oracle "out of host capacity" blocks Always Free provisioning | High | Low | Hetzner CX23/CAX11 as paid fallback (≈ €5.5–6 / mo); design identical |
| Scope creep toward "build YouTube" | High | High | Non-goals list (§3.2) is binding; anything new goes to Phase 5 backlog |
| Egress cost from video playback | Medium | High | R2 (zero egress) + Cloudflare CDN; never serve video via API; B2 via Bandwidth Alliance as fallback |

---

## 12. Open Questions (to resolve during Phase 0/1)

1. Auth provider for the eventual frontend integration: self-issued JWT vs Clerk/Supabase Auth/Auth.js? MVP verifies any RS256/EdDSA JWT via JWKS URL — decision deferred, interface fixed.
2. Public playback: fully public objects behind CDN vs signed playlist URLs? MVP: public-read `public` bucket with unguessable `videoId` (UUIDv7); signed URLs are a Phase 5 option.
3. Do we keep source files after processing (re-transcode later) or delete to save storage? MVP: keep for 7 days (lifecycle rule), configurable.
4. Thumbnail sprite density (1 frame / 5 s vs 1 / 10 s) — decide after Phase 2 UX check.

---

## 13. Glossary

- **HLS** — HTTP Live Streaming; playlist (`.m3u8`) + media segments (`.ts` or fMP4).
- **Ladder** — the set of renditions (resolution/bitrate pairs) produced for a source.
- **Rendition** — one encoded variant (e.g. 720p @ 2.8 Mbps).
- **Fan-out / fan-in** — one probe job spawning N rendition jobs; one package job waiting for all of them.
- **DLQ** — Dead-Letter Queue: parking lot for jobs that exhausted retries or are unrecoverable.
- **Stalled job** — a job whose worker stopped renewing its lock (crash, partition); re-queued automatically.
- **KEDA** — Kubernetes Event-Driven Autoscaler; scales Deployments on external metrics such as queue length.
- **Effectively-once** — at-least-once delivery combined with idempotent processing so the observable outcome equals exactly-once.
