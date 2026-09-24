# SDD — Video Ingestion & Transcoding Backend ("video-pipeline")

| Field | Value |
|---|---|
| Document | System Design Document + Implementation Blueprint |
| Version | 1.0 — baseline for PDLC kick-off |
| Date | 2026-09-03 |
| Author | Mateusz Szebestik — Principal Architect / Staff Engineer (solo) |
| Status | **Approved for implementation** — requirements in `docs/PRD.md` |
| Facts verified | Vendor pricing, library versions and platform limits were re-verified against official sources on 2026-09-03; see §17 "Fact sheet". |

> **How to read this document.** §1–3 give the shape of the system. §4 is the decision log: every stack choice with ranked alternatives and the reason the winner won. §5–11 are the deep dives (data model, API, storage, FFmpeg, queue/worker design, real-time status, security). §12–13 cover deployment, autoscaling and observability. §14 is the load-test plan, §15 the repository layout and tooling, §16 the environment variables, §17 the fact sheet, §18 the phased roadmap.

---

## Table of Contents

1. Context & Scope
2. Architecture Overview
3. End-to-End Data Flows
4. Architecture Decision Records (ranked alternatives)
5. Domain Model & Database Schema
6. API Contract
7. Object Storage Layout
8. Media Processing (FFmpeg) Specification
9. Distributed Queue & Worker Design (deep dive)
10. Real-Time Status (SSE)
11. Security
12. Deployment Topologies (local → Kubernetes → cloud) & Cost Model
13. Autoscaling & Observability
14. Distributed Load Testing & Chaos Plan
15. Repository Structure, Tooling & External Services
16. Environment Variables
17. Fact Sheet (verified 2026-09-03)
18. Implementation Roadmap (Phase 0–4)
19. Risks, Open Issues, Future Work
20. Appendix: Job Contracts (code)

---

## 1. Context & Scope

`video-pipeline` is the backend for a YouTube-like application. A creator uploads a video from a browser; the system probes it, transcodes it into an adaptive-bitrate HLS ladder, generates thumbnails, publishes a master playlist, and tells the client when it is playable. Everything after the upload is asynchronous and runs on a pool of stateless workers fed by a durable job queue.

Three pillars from the original brief are treated as first-class, co-equal requirements:

1. **Video Processing Pipeline** — direct upload, S3-compatible storage, probe, multi-rendition FFmpeg transcode, HLS packaging.
2. **Distributed Job Queue** — worker pools, retries with exponential backoff, DLQ, acknowledgements, idempotency, concurrency control.
3. **Scalability & Distributed Load Testing** — containerised autoscaling on queue depth, metrics/tracing/logs, high-concurrency and chaos simulation.

### 1.1 In scope

Everything server-side from the moment the browser asks for an upload URL to the moment a player fetches `master.m3u8` from the CDN, plus the operational tooling to run it (dashboards, alerts, admin endpoints, load tests, deployment manifests).

### 1.2 Out of scope

Frontend, live streaming, DRM, moderation, social features, GPU encoding, HEVC/AV1 output, multi-region. See PRD §3.2.

### 1.3 Design principles (used to break ties throughout)

| # | Principle | Consequence |
|---|---|---|
| P1 | **The API never touches video bytes.** | Presigned uploads; CDN playback; API is control-plane only. |
| P2 | **Postgres is the truth, Redis is a cache of intent.** | Any queue state can be rebuilt from DB by the reconciler; losing Redis loses time, not videos. |
| P3 | **Every step is idempotent; delivery is at-least-once.** | Deterministic IDs and object keys; compare-and-set transitions; overwrite is safe. |
| P4 | **Fail fast on poison, retry patiently on transient.** | Error taxonomy decides retry vs DLQ at throw-site, not in config. |
| P5 | **Provider-agnostic edges.** | S3 API, Postgres wire protocol, Redis protocol, OpenTelemetry — no vendor SDK leaks past `packages/*`. |
| P6 | **One image, many roles.** | Worker stage is a runtime env var; scaling granularity without build granularity. |
| P7 | **Measure, then believe.** | Every NFR has a metric and a load-test scenario that exercises it. |
| P8 | **Cheap by default.** | Scale-to-zero, free tiers, zero-egress storage. Anything that bills per-command or per-GB-egress is suspect. |
| P9 | **Local-first.** Everything runs on one machine with no external accounts and no internet; the cloud rung is optional. | Every dependency has a compose container (Postgres, Redis, MinIO, dev JWKS issuer, Prometheus/Grafana/Tempo/Loki); `.env.example` is all-local; no phone-home; `make smoke-offline` gates CI (ticket 35). |
| P10 | **Optimal execution & zero-waste developer ergonomics.** | Sub-second feedback loops, Docker Buildx layer caching, incremental builds, fast healthcheck retries, and rapid local setup (`make up`, `make dev`). Performance or cycle-time regressions are treated as blocking defects (ticket 80). |

---

## 2. Architecture Overview

### 2.1 High-level diagram

```mermaid
flowchart LR
    subgraph Client
        FE["youtube-frontend<br/>browser"]
        PLAYER["HLS player<br/>hls.js / Safari"]
    end

    subgraph Edge["Edge — Cloudflare (free)"]
        CDN["CDN / custom domain<br/>caches playlists + segments"]
    end

    subgraph API_PLANE["Control plane — apps/api (Node 24 LTS · Fastify 5)"]
        API["REST API<br/>uploads · videos · admin · Bull Board"]
        SSE["SSE hub<br/>/v1/videos/:id/events"]
    end

    subgraph State
        PG[("PostgreSQL<br/>source of truth")]
        REDIS[("Redis / Valkey<br/>BullMQ queues · Pub/Sub")]
        RAW[("Object storage<br/>bucket: raw (private)")]
        PUB[("Object storage<br/>bucket: public (CDN-fronted)")]
    end

    subgraph WORKERS["Data plane — apps/worker (Bun 1.4) · one image · WORKER_STAGE=…"]
        direction TB
        W1["probe"] ~~~ W2["transcode-1080p · 720p · 480p"] ~~~ W3["thumbnail"] ~~~ W4["package"] ~~~ W5["notify"] ~~~ W6["housekeeping"]
    end

    subgraph OBS["Observability & autoscaling"]
        PROM["Prometheus"] --> GRAF["Grafana"]
        TEMPO["Tempo · Loki"] --> GRAF
        PROM -- "queue depth" --> KEDA["KEDA"]
    end

    FE -- "1 POST /uploads · 4 POST /complete" --> API
    API -- "2 presigned URLs · 202" --> FE
    FE -- "3 PUT parts — bytes never touch the API" --> RAW
    API -- "5 HEAD verify" --> RAW
    API -- "6 enqueue probe" --> REDIS
    API <--> PG
    FE -- "7 subscribe" --> SSE
    REDIS -. "Pub/Sub video:*" .-> SSE

    REDIS -- "pull jobs · ack · lock renewal" --> WORKERS
    WORKERS -- "CAS transitions · events · steps" --> PG
    RAW -- "source" --> WORKERS
    WORKERS -- "HLS · thumbnails · master.m3u8" --> PUB
    WORKERS -- "PUBLISH progress/status" --> REDIS

    PLAYER -- "8 GET master.m3u8 + segments" --> CDN --> PUB

    API -. "metrics · traces · logs" .-> OBS
    WORKERS -. "metrics · traces · logs" .-> OBS
    KEDA -- "replicas 0..N per stage" --> WORKERS
```

### 2.2 Components and responsibilities

| Component | Runtime | Responsibility | Scales |
|---|---|---|---|
| `apps/api` | Node.js 24 LTS · Fastify 5 | Auth, upload orchestration (presign / multipart / complete / verify), video CRUD, SSE hub, admin (Bull Board, DLQ replay), `/metrics`, `/healthz`, `/readyz`. Stateless. | Horizontally, on CPU/RPS (HPA). Long-running, so cold start is irrelevant. |
| `apps/worker` | Bun 1.4 · one image | `main.ts` reads `WORKER_STAGE` and boots exactly one BullMQ `Worker` for that queue. Stages: `probe`, `transcode-1080p`, `transcode-720p`, `transcode-480p`, `thumbnail`, `package`, `notify`, `housekeeping`. | Per stage, on queue depth (KEDA), 0 → N. |
| PostgreSQL 16 | Neon (cloud) / container (local) | Source of truth: users, videos, uploads, renditions, processing steps, append-only `video_events`, DLQ mirror. | Vertical; read replicas out of scope. |
| Redis 7 / Valkey 8 | container / same VPS | BullMQ queues (`noeviction`), Pub/Sub for SSE fan-out, small caches (presign throttles, idempotency keys). | Single node; persistence AOF `everysec`. |
| Object storage | MinIO (local) / Cloudflare R2 (cloud) | `raw` bucket (private, sources, 7-day lifecycle) and `public` bucket (HLS, thumbnails, CDN-fronted). | Managed. |
| Cloudflare CDN | free plan | Caches segments/playlists in front of `public` bucket; custom domain; zero egress from R2. | Managed. |
| Prometheus · Grafana · Tempo · Loki | containers (local) / Grafana Cloud free (cloud) | Metrics, dashboards, traces, logs. | Managed in cloud. |
| KEDA 2.20 | Kubernetes add-on | `ScaledObject` per worker stage; Prometheus scaler (primary) or Redis list scaler (fallback). | n/a |
| Bull Board | mounted in `apps/api` | Queue/job inspection UI at `/admin/queues`. | with API |

### 2.3 Runtime split — why two runtimes

Agreed in the design discussion and kept here: **Node LTS for the API, Bun for workers.**

- Workers scale from zero; Bun's ~10–15 ms cold start (vs ~60–120 ms for Node) is on the critical path of "backlog appears → first job starts". Workers spawn `ffmpeg` and talk to Redis/S3 — pure-JS dependencies (`bullmq`, `ioredis`, `@aws-sdk/client-s3`) that run on Bun today.
- The API is long-running; cold start is irrelevant and ecosystem stability (SSE, auth plugins, rate limiting, Bull Board) matters more.
- **Guard-rail:** worker code is written runtime-neutral (`node:child_process`, `node:fs`, `node:stream` — no `Bun.*` APIs). `apps/worker/Dockerfile` accepts `--build-arg WORKER_RUNTIME=bun|node`; CI runs the worker test suite on both. If a Bun regression bites (they exist: stdio piping edge cases, AWS SDK stream hangs under concurrency were reported on 1.3.x), flipping the runtime is a one-line change, not a rewrite.

---

## 3. End-to-End Data Flows

### 3.1 Upload (multipart, direct-to-storage)

```mermaid
sequenceDiagram
    autonumber
    participant B as Browser
    participant API as apps/api
    participant PG as Postgres
    participant S3 as Object storage (raw)
    participant Q as Redis / BullMQ

    B->>API: POST /v1/uploads {filename, sizeBytes, contentType, sha256?}
    API->>API: validate size/type/quota · pick strategy (single ≤100MB, else multipart) · partSize = clamp(ceil(size/1000), 8MB, 64MB)
    API->>PG: INSERT videos(status=UPLOADING), uploads(...)
    API->>S3: CreateMultipartUpload(key=raw/{videoId}/source.{ext})
    API->>PG: UPDATE uploads SET multipart_upload_id
    API-->>B: {videoId, uploadId, strategy, partSize, parts:[{n, url, expiresAt}...]}
    loop parts in parallel (client concurrency 4–6), resumable
        B->>S3: PUT presigned part n  (bytes never pass through API)
        S3-->>B: ETag
    end
    Note over B,API: On resume: GET /v1/uploads/:id → ListParts → already-uploaded ETags · POST /parts?from=n for fresh URLs
    B->>API: POST /v1/uploads/:id/complete {parts:[{n, etag}]}
    API->>S3: CompleteMultipartUpload
    API->>S3: HeadObject → ContentLength, ContentType
    API->>API: verify size == declared, ≤ cap, type allowlisted (else DeleteObject, status=REJECTED)
    API->>PG: UPDATE videos SET status=UPLOADED, source_size WHERE status=UPLOADING (CAS)
    API->>PG: INSERT video_events(type=upload.completed)
    API->>Q: add("probe", {videoId, sourceKey, traceparent}, {jobId: `${videoId}--probe`})
    API-->>B: 202 {videoId, status: "UPLOADED"}
```

Design notes:

- **The trigger is the explicit `complete` call, not a bucket notification.** Cloudflare R2 event notifications can only target Cloudflare Queues (not arbitrary webhooks), and MinIO webhooks are local-only. A client-driven completion plus server-side `HEAD` verification is portable and testable. MinIO bucket notifications can be wired as an *accelerator* in dev, but the pipeline must never depend on them.
- **Belt and braces against the "complete" call never arriving:** the `housekeeping` worker runs a `reconcile-uploads` schedule every 15 min: (a) videos `UPLOADING` for > 24 h → `AbortMultipartUpload`, status `ABANDONED`; (b) videos `UPLOADED` with no `probe` step row for > 5 min → re-enqueue `probe` (idempotent job id makes this safe). The bucket also carries a lifecycle rule `AbortIncompleteMultipartUpload: 1 day`.
- Presigned PUT URLs expire after 15 min; part URLs are issued in batches (`POST /uploads/:id/parts?from=n&count=100`) so a slow 4 GB upload never holds thousands of live URLs.

### 3.2 Processing pipeline (fan-out / fan-in)

```mermaid
sequenceDiagram
    autonumber
    participant Q as BullMQ
    participant P as probe worker
    participant T as transcode-{1080p,720p,480p} workers
    participant TH as thumbnail worker
    participant PK as package worker
    participant N as notify worker
    participant PG as Postgres
    participant S3 as Object storage
    participant PS as Redis Pub/Sub → SSE

    Q->>P: probe job (videoId)
    P->>PG: CAS videos UPLOADED→PROBING · upsert processing_steps(probe, RUNNING, attempt)
    P->>S3: GetObject (range/stream) → ffprobe -show_streams -show_format
    P->>P: validate (duration ≤ 60min, codec allowlist, sane dims) → else throw UnrecoverableError(code)
    P->>P: compute ladder: renditions with height ≤ source height (min 1)
    P->>PG: UPDATE videos SET duration_ms, width, height, fps, ladder · status=PROCESSING · INSERT renditions(PENDING)
    P->>Q: FlowProducer.add({ name:"package", queue:"package", jobId:`${videoId}--package`, children:[transcode-1080p, transcode-720p, transcode-480p, thumbnail] })
    P->>PS: PUBLISH video:{id} {status:PROCESSING, ladder}

    par each rendition, independent queue & worker pool
        Q->>T: transcode-720p job
        T->>PG: upsert processing_steps(transcode,720p,RUNNING)  · renditions.status=RUNNING
        T->>S3: stream source → ffmpeg → tmp/{videoId}/720p/*.ts + index.m3u8
        T-->>PS: progress every 2s (parsed from ffmpeg -progress) → job.updateProgress() + PUBLISH
        T->>S3: upload segments as they close (concurrency 4) + index.m3u8 last
        T->>PG: renditions.status=DONE, segment_count, bytes, ms  · steps DONE (fencing token check)
    and thumbnails
        Q->>TH: thumbnail job → poster.jpg, sprite.jpg, sprite.vtt → S3 public
    end

    Note over Q,PK: parent "package" leaves waiting-children only when ALL children completed
    Q->>PK: package job
    PK->>S3: HEAD every rendition index.m3u8 + sample segments · read children results via getChildrenValues()
    PK->>S3: PUT videos/{id}/hls/master.m3u8 (BANDWIDTH, RESOLUTION, CODECS, FRAME-RATE)
    PK->>PG: CAS videos PROCESSING→READY, master_playlist_key, ready_at  · INSERT video_events(video.ready)
    PK->>Q: add("notify", {videoId, event:"video.ready"})
    Q->>N: notify job → PUBLISH video:{id} {status:READY, playbackUrl} · optional HMAC webhook
```

Failure path (any child): BullMQ retries with backoff; when attempts are exhausted or an `UnrecoverableError` is thrown, the `failed` handler moves the job to `dlq`, marks the rendition `FAILED`, and — because `failParentOnFailure: true` is set on children — the parent `package` job fails too, which flips the video to `FAILED` with the first child error as `errorCode`. See §9.6.

### 3.3 Playback

```mermaid
sequenceDiagram
    participant B as Browser (hls.js)
    participant API as apps/api
    participant CDN as Cloudflare CDN
    participant S3 as public bucket (R2)

    B->>API: GET /v1/videos/:id
    API-->>B: {status:READY, playbackUrl:"https://cdn.example.com/videos/{id}/hls/master.m3u8", poster, sprite}
    B->>CDN: GET master.m3u8 (cache: 60s)
    CDN->>S3: miss → fetch
    B->>CDN: GET 720p/index.m3u8, seg_00001.ts … (cache: immutable, 1y)
```

The API is not in the playback path (P1). Playlists are cached briefly (VOD playlists are immutable once READY, but a 60 s TTL keeps re-processing cheap); segments are immutable and cached for a year.

### 3.4 Status reporting

Workers publish to Redis channel `video:{videoId}`; each API instance holds one pattern subscription (`PSUBSCRIBE video:*`) and fans out to its local SSE connections. On connect the API sends a **snapshot** from Postgres first, then live events. Details in §10.

### 3.5 State machine

```mermaid
stateDiagram-v2
    [*] --> UPLOADING: POST /uploads
    UPLOADING --> UPLOADED: complete + HEAD ok
    UPLOADING --> REJECTED: HEAD mismatch / over cap / bad type
    UPLOADING --> ABANDONED: reconciler, >24h
    UPLOADED --> PROBING: probe job starts
    PROBING --> PROCESSING: probe ok, flow created
    PROBING --> FAILED: UnrecoverableError
    PROCESSING --> READY: package ok
    PROCESSING --> FAILED: child exhausted retries / unrecoverable
    FAILED --> PROBING: admin re-process
    READY --> DELETED: soft delete + purge job
    REJECTED --> [*]
    ABANDONED --> [*]
    DELETED --> [*]
```

Transitions are enforced in SQL with compare-and-set (`UPDATE … WHERE id = $1 AND status = $expected`), and every transition writes a `video_events` row in the same transaction.

---

## 4. Architecture Decision Records

Every record lists the candidates **ranked** (1 = chosen), the reason the winner won for *this* workload, why the runners-up lost, and the condition under which we would revisit. Scores are 1–5 on the axes that matter most here: **fit** (technical fit for an FFmpeg-orchestrating, I/O-bound pipeline), **velocity** (solo developer speed), **cost** (free/cheap to run), **career** (market signal / learning value).

### ADR-01 — Primary language & runtime: TypeScript (Node LTS API + Bun workers)

| Rank | Option | Fit | Velocity | Cost | Career | Notes |
|---|---|---|---|---|---|---|
| **1** | **TypeScript** — Node 24 LTS (API) + Bun 1.4 (workers) | 4 | 5 | 5 | 4 | Best queue library for Redis (BullMQ), shared types with the TS frontend, huge ecosystem; workload is I/O-bound orchestration, FFmpeg does the CPU work. |
| 2 | Go | 5 | 3 | 5 | 5 | Best raw fit for worker concurrency and small images; but no BullMQ-class library (asynq/river are good, not equal), slower solo velocity, no type sharing with frontend. **Kept as the Phase-4+ worker rewrite path** (a Go worker app beside the TypeScript one; not built). |
| 3 | .NET 8/9 (C#) | 4 | 3 | 4 | 4 | Excellent async I/O, MassTransit/Hangfire mature; heavier images, less natural for R2/MinIO tooling, weaker fit with the frontend stack. |
| 4 | Java / Spring Boot | 4 | 2 | 3 | 4 | Enterprise-standard but slowest cold start (kills scale-to-zero economics), heaviest memory footprint on 4 GB nodes, slowest solo iteration. |

**Why it won.** The hot path is `ffmpeg` as a subprocess; the application layer moves bytes between S3 and a child process and updates state. That is exactly what Node/Bun's event loop is good at, and it is where BullMQ — the most complete Redis job library in any language (flows, stalled-job detection, rate limiting, priorities, job schedulers, custom backoff) — lives. TypeScript also lets `packages/server/job-contracts` be consumed by the frontend later for SSE event types.

**Why the runtime split.** Cold start matters only where we scale from zero (workers); ecosystem stability matters most where we accumulate features (API). Bun runs `bullmq`/`ioredis`/`@aws-sdk/client-s3` (all pure JS). Bun's native `Bun.redis` client is *not* usable by BullMQ (open issue) — we use `ioredis` on both runtimes. Bun 1.4 (Aug 2026) is the current stable line; the Anthropic acquisition (Dec 2025) removed the "single small startup" risk.

**Consequences.** Worker code must stay runtime-neutral (no `Bun.*` APIs); CI tests workers under both runtimes; `WORKER_RUNTIME` build arg.

**Revisit if.** Bun regressions in `child_process`/AWS SDK streams recur on stable releases → flip workers to Node (one-line). Transcode orchestration itself becomes CPU-bound (e.g. in-process demuxing) → Go worker.

---

### ADR-02 — HTTP framework: Fastify 5

| Rank | Option | Reason |
|---|---|---|
| **1** | **Fastify 5** | Fastest mainstream Node framework; first-class JSON-schema/zod validation (`fastify-type-provider-zod`), plugin encapsulation, `reply.raw` for SSE, mature `@fastify/rate-limit`, `@fastify/jwt`, `@bull-board/fastify`, `@fastify/under-pressure` (load shedding). |
| 2 | Hono | Excellent, runtime-agnostic, tiny; but weaker ecosystem for server-side concerns we need (Bull Board adapter, under-pressure, mature JWT/JWKS plugins). Would be #1 if the API ran on Bun/edge. |
| 3 | NestJS | Enterprise-familiar DI; adds a large abstraction layer for a solo project, slower cold start, more ceremony per endpoint. Good career signal but poor velocity here. |
| 4 | Express 5 | Ubiquitous, but slower, weaker typing/validation story, no encapsulation model. |

**Revisit if.** API moves to Bun for a single-runtime deployment → Hono.

---

### ADR-03 — Message broker: BullMQ 6 on Redis (task queue), with Postgres `video_events` as the append-only log

The brief asked explicitly: transient task queue vs event-streaming log vs hybrid.

| Rank | Option | Fit | Velocity | Cost | Career | Notes |
|---|---|---|---|---|---|---|
| **1** | **BullMQ (Redis)** | 5 | 5 | 5 | 4 | Task-queue semantics we need: per-job ack, retries w/ exponential backoff + jitter, delayed jobs, priorities, rate limiting, **Flows** (parent/child fan-out/fan-in), stalled-job detection via lock renewal, job progress, job schedulers. Redis is already needed for SSE Pub/Sub → one fewer moving part. |
| 2 | RabbitMQ (quorum queues) | 5 | 3 | 4 | 5 | Also a correct fit: per-message ack/nack, `x-delivery-limit` + DLX for DLQ, consumer prefetch for concurrency. Loses on: extra broker to run on a 4 GB node; delayed retries need the delayed-message plugin or TTL+DLX dance; no native parent/child flows; consumer timeout (30 min default) must be raised for long transcodes. Best "second implementation" for learning. |
| 3 | pg-boss (Postgres as queue) | 4 | 4 | 5 | 3 | Zero extra infrastructure, transactional enqueue with business writes (solves outbox for free), `SKIP LOCKED` polling. Loses on: no flows, fewer knobs, polling latency, DB load under 1000-job bursts, less impressive operationally. Strong candidate if we ever drop Redis. |
| 4 | Kafka / Redpanda | 2 | 2 | 2 | 5 | **Wrong tool for the pipeline.** Partition-ordered log with consumer-group offsets means a 10-minute 1080p transcode blocks every job behind it in the partition (head-of-line blocking); `max.poll.interval.ms` gymnastics for long jobs; no per-message retry/backoff/DLQ — you build them; no fan-in. Kafka shines for *replayable events consumed by many independent consumers* (analytics, search indexing) — not for distributing CPU jobs. |
| 5 | Temporal | 5 | 3 | 3 | 4 | Durable workflows would model the pipeline beautifully (fan-out, retries, heartbeats built in) but adds a heavy server + Cassandra/Postgres deployment and hides the very mechanics this project exists to learn. |
| 6 | Raw Redis Streams | 3 | 2 | 5 | 3 | Consumer groups + `XAUTOCLAIM` can build a queue, but we would re-implement everything BullMQ already gives us. |

**Hybrid verdict.** A pipeline is a *work distribution* problem → task queue. The *"what happened to this video"* history is an *event log* problem → but at MVP scale, Kafka is a €0-budget-breaking, operationally heavy answer to it. We therefore keep an **append-only `video_events` table in Postgres** (every state transition, every retry, every DLQ move) which gives us replayability and audit for free and can be tailed into Kafka/Redpanda later (Debezium/outbox) if multiple downstream consumers appear. Redis **Pub/Sub** carries the ephemeral real-time fan-out to SSE (loss-tolerant by design: SSE clients re-sync from the DB snapshot).

**Consequences.** Redis must run with `maxmemory-policy noeviction` and AOF persistence; queue names cannot contain `:` (BullMQ throws) — we use `transcode-1080p` and job IDs `${videoId}--probe`. BullMQ 6 made `ioredis` an optional peer dependency and removed legacy repeatables in favour of Job Schedulers — we target v6 APIs from day one. No native DLQ exists → we implement the documented pattern (§9.6).

**Revisit if.** Multiple independent consumers need the event history (search, analytics, notifications) → add Redpanda fed from `video_events`/outbox. Per-tenant fairness becomes a product requirement → BullMQ Pro groups or RabbitMQ per-tenant queues.

---

### ADR-04 — Database: PostgreSQL 16 (Neon in cloud) + Drizzle ORM

| Rank | Option | Reason |
|---|---|---|
| **1** | **PostgreSQL** (Neon Free: 0.5 GB, 100 CU-h/mo, autosuspend 5 min) | Relational fits the model (videos → renditions → steps); we need `ON CONFLICT`, `SKIP LOCKED`, advisory locks, `jsonb` for ladder/metadata, CAS updates. Neon scale-to-zero matches our cost model. Same image locally (`postgres:16-alpine`). |
| 2 | Supabase Postgres | Same engine, but free projects pause after 1 week idle (Neon suspends and *resumes on demand*); Supabase Auth is attractive for the frontend later — may be used for auth only. |
| 3 | SQLite/libSQL (Turso) | Enough for a demo, but multi-writer workers + a stateless API need a network DB. |
| 4 | MongoDB Atlas free | Document model is a poor fit for the constraints/transactions we rely on. |

**ORM ranking.**

| Rank | Option | Reason |
|---|---|---|
| **1** | **Drizzle ORM** (0.45 stable; 1.0 RC) + `drizzle-kit` migrations + `postgres.js` driver | SQL-first: `insert().onConflictDoUpdate()`, `for('update', {skipLocked:true})`, raw `sql` for CAS, no code-gen step, tiny bundle (matters for Bun cold start), runs identically on Node and Bun. |
| 2 | Prisma 7/8 | Since v7 the client is Rust-free and Prisma 8 (RC, tagged `latest` on npm) is a full TS rewrite — the old "binary engine" objection is gone. Still: generated client step, less direct SQL control for CAS/locking patterns, heavier. Solid #2. |
| 3 | Kysely | Excellent typed query builder; Drizzle gives the same plus a schema/migration story. |

**Revisit if.** Drizzle 1.0 GA introduces breaking changes we cannot absorb → Kysely.

---

### ADR-05 — Redis flavour: self-hosted Redis 7 / Valkey 8 next to the workers

| Rank | Option | Reason |
|---|---|---|
| **1** | **Self-hosted `redis:7-alpine` (or `valkey/valkey:8`)** on the same VPS/cluster | BullMQ polls, renews locks and runs Lua scripts constantly; a queue with 8 idle workers can issue hundreds of thousands of commands per day. Self-hosting makes that free. Valkey is Redis-protocol compatible (BullMQ requires Redis ≥ 6.2 semantics; not officially listed but widely used). |
| 2 | Upstash Redis Free (500k commands/**month**, 256 MB) | Officially supports BullMQ but Upstash itself warns BullMQ's polling burns commands and recommends fixed plans ($10/mo+). 500k/month ≈ 11 commands/min budget — exhausted in a day by idle workers. Use only for something non-chatty. |
| 3 | Dragonfly | The only vendor BullMQ officially tests against; needs `{hashtag}` queue names; heavier binary, no benefit at our scale. |
| 4 | Redis Cloud free (30 MB) | Too small for job payloads + AOF. |

**Consequences.** Redis config: `maxmemory-policy noeviction`, `appendonly yes`, `appendfsync everysec`, `maxmemory 256mb` (local). Separate logical DB indexes: `0` queues, `1` pub/sub & cache.

---

### ADR-06 — Object storage: MinIO locally; Cloudflare R2 in cloud (Backblaze B2 fallback)

| Rank | Option | Free tier | Egress | Notes |
|---|---|---|---|---|
| **1** | **Cloudflare R2** | 10 GB storage, 1 M Class A, 10 M Class B ops / month | **$0** | Zero egress is decisive for video delivery. S3 API: multipart ✔, presigned PUT/GET ✔ (≤ 7 days, no POST-policy uploads). Custom-domain CDN on the free plan. Event notifications only to Cloudflare Queues → we do not rely on them (ADR-09). |
| 2 | Backblaze B2 | 10 GB | free up to 3× storage/month, then $0.01/GB; **unlimited free to Cloudflare** via Bandwidth Alliance | Full S3 API incl. notifications. Best fallback if R2 free tier changes; put Cloudflare CDN in front. |
| 3 | Supabase Storage | 1 GB, 5 GB egress | | Too small; egress capped. |
| 4 | AWS S3 | 5 GB / 12 months | $0.09/GB | Egress pricing is the exact thing we must avoid. |
| Local | **MinIO** (`cgr.dev/chainguard/minio`, pinned by digest) | — | — | Faithful S3 emulation incl. multipart, presigned URLs, lifecycle rules, bucket notifications (webhook) for dev. |

**Consequences.** One `packages/server/storage` module over `@aws-sdk/client-s3` v3 with `forcePathStyle` for MinIO and `region: 'auto'` for R2. Two buckets: `raw` (private) and `public` (CDN-fronted). Object keys are deterministic (§7).

---

### ADR-07 — Delivery format: HLS with MPEG-TS segments (MVP), CMAF/fMP4 upgrade path

| Rank | Option | Reason |
|---|---|---|
| **1** | **HLS, `.ts` segments, 6 s target duration, 2 s GOP** | Matches the brief; simplest FFmpeg muxer path (`-f hls -hls_segment_type mpegts`); plays everywhere (hls.js, Safari, Android). Apple's authoring spec: target duration SHOULD be 6 s, IDR every 2 s, segments MUST start with an IDR. |
| 2 | HLS + DASH from **CMAF fMP4** | One segment set, two manifests (`.m3u8` + `.mpd`); required for HEVC/AV1; lower overhead than TS. Planned Phase-4 stretch: flip `-hls_segment_type fmp4` and add `EXT-X-MAP`; generate `.mpd` via shaka-packager or ffmpeg's dash muxer. |
| 3 | DASH only | No native Safari/iOS support. |
| 4 | Progressive MP4 per rendition | No adaptive switching; large seeks; not "YouTube-like". |

---

### ADR-08 — Transcode parallelism: one job per rendition (fan-out), chunked transcoding as stretch

| Rank | Option | Reason |
|---|---|---|
| **1** | **One BullMQ job per rendition**, separate queues `transcode-1080p/720p/480p` | Parallelism across workers, independent retry/backoff per rendition, per-queue KEDA sizing (1080p is ~2.5× the CPU of 480p), 480p can be *first playable* while 1080p still encodes. Cost: source decoded 3× (acceptable; decode is cheap relative to x264 encode). |
| 2 | Single FFmpeg with three outputs (`-filter_complex split=3`) | Decode once, encode thrice in one process — most CPU-efficient, but the job is as slow as the slowest rendition, retries redo everything, and it defeats per-queue autoscaling. Good for a single-node deployment; kept as a `TRANSCODE_MODE=combined` option for tiny nodes. |
| 3 | **Chunked (YouTube-style)**: split source at keyframes into N chunks → N×renditions jobs → concat | Highest parallelism and fastest wall-clock for long videos; requires keyframe-aligned splitting (`-f segment -c copy -segment_time 30 -reset_timestamps 1`), concat with `-f concat`, and audio handled separately to avoid seams. **Designed for (job contract has `chunkIndex`), built in Phase 4 stretch.** |

---

### ADR-09 — Upload-completion trigger: explicit `complete` call + server verification (+ reconciler)

| Rank | Option | Reason |
|---|---|---|
| **1** | **Client `POST /uploads/:id/complete` → server `CompleteMultipartUpload` + `HeadObject` → enqueue** | Portable across MinIO/R2/B2, testable, synchronous validation (size/type) before any work starts; client gets an immediate 202 with status. |
| 2 | Bucket event notification → webhook/queue | Fast and "event-driven", but R2 only emits to Cloudflare Queues; MinIO webhooks are dev-only; B2 supports HTTP notifications. Used as an *optional* accelerator in dev to demonstrate the pattern, never the sole trigger. |
| 3 | Polling `ListObjects` | Wasteful, slow, Class B ops cost. |

**Safety net.** `housekeeping` `reconcile-uploads` scheduler (every 15 min) catches videos stuck in `UPLOADED` with no probe step and abandons stale `UPLOADING` rows; lifecycle rule aborts incomplete multiparts after 1 day.

---

### ADR-10 — Status transport: Server-Sent Events

| Rank | Option | Reason |
|---|---|---|
| **1** | **SSE** (`text/event-stream`) | Unidirectional server→client is all we need; plain HTTP (works through every proxy/CDN, HTTP/2 multiplexed), browser `EventSource` auto-reconnects with `Last-Event-ID`, no extra library, trivial to load test with k6. |
| 2 | WebSockets | Bidirectional and stateful for no benefit here; needs sticky sessions or a pub/sub layer anyway; harder through some proxies. Revisit if the client must *send* real-time commands (e.g. cancel upload). |
| 3 | Long polling | Simple but wasteful; SSE is strictly better where supported. |
| 4 | Managed push (Pusher/Ably) | Costs money; adds a vendor for a solved problem. |

**Consequences.** `: ping` comment every 15 s (proxy timeouts), snapshot-on-connect from Postgres, Redis `PSUBSCRIBE video:*` per API instance, per-connection backpressure (drop progress events if `res.write` returns false; never drop terminal events).

---

### ADR-11 — Repository topology: modular monorepo, multiple deployables, one worker image

| Rank | Option | Reason |
|---|---|---|
| **1** | **pnpm workspaces + Turborepo monorepo**: `apps/api`, `apps/worker`, `packages/*` | Shared `job-contracts`, `db`, `storage`, `ffmpeg`, `observability` packages — zero contract drift between producer and consumers; one CI; one `docker compose up`. Independent deployables give independent scaling. |
| 2 | Multi-repo microservices | Team-autonomy tooling for a team of one = "distributed monolith": duplicated types, N pipelines, publish-bump-cycle for every payload change. |
| 3 | Single monolith process | Cannot scale `transcode-1080p` independently of `probe`; cannot run Bun for workers and Node for API. |

**One image, many roles.** `apps/worker` builds one image; each Kubernetes Deployment / compose service sets `WORKER_STAGE`. Split into separate images only if a stage's dependencies diverge materially (they will not: ffmpeg is the fixed cost every stage pays).

**Tooling ranking:** pnpm + Turborepo (chosen) > Nx (heavier, more opinionated) > Bun workspaces (would force Bun for the API build too) > npm workspaces (no task caching).

---

### ADR-12 — Autoscaling: KEDA `ScaledObject` per stage, Prometheus scaler primary, Redis-list scaler fallback

| Rank | Option | Reason |
|---|---|---|
| **1** | **KEDA + Prometheus scaler** on `bullmq_queue_jobs{state=~"waiting|active|prioritized"}` | Scales on *waiting + active* so a busy worker is never counted as spare capacity; single metric source for dashboards, alerts and scaling; supports `activationThreshold` for scale-to-zero. |
| 2 | KEDA + Redis list scaler (`listName: bull:transcode-1080p:wait`) | Zero dependency on Prometheus; but only sees the plain `wait` list — prioritized jobs live in a ZSET (`:prioritized`) and are invisible, and it ignores `active`. Fine as a fallback. |
| 3 | KEDA `ScaledJob` (one K8s Job per BullMQ job) | KEDA's own recommendation for long-running work, but it conflicts with BullMQ's pull model (the Job must still *pull* a job; if two Jobs start and one queue item exists, one Job idles). Kept as an experiment note. |
| 4 | Compose-level scaler script (`docker compose up --scale`) | Used in **Phase 3-lite** for the non-Kubernetes path; demonstrates the loop (poll depth → set replicas) without a cluster. |
| 5 | CPU-based HPA | Lagging indicator; workers are pegged at 100 % CPU by design while transcoding — CPU says nothing about backlog. |

**Graceful scale-in.** `terminationGracePeriodSeconds: 900` for transcode pods; on `SIGTERM` the worker stops taking new jobs and lets the active job finish (`worker.close()`); if the pod is killed anyway, lock expiry → stalled → re-queue → idempotent redo.

---

### ADR-13 — Load testing: k6 (+ k6-operator for distributed runs)

| Rank | Option | Reason |
|---|---|---|
| **1** | **k6 2.x** | JS scenarios (same language as the codebase), built-in thresholds → CI pass/fail, `k6-operator` 1.6 runs distributed tests in the same kind/k3s cluster, native Prometheus remote-write output, Grafana Cloud k6 gives 500 VU-hours/month free for cloud runs. Handles presigned S3 PUTs and SSE (via `k6/experimental/streams` or `xk6-sse`). |
| 2 | Locust | Python, great distributed master/worker model; second language in the repo; weaker CI thresholds story. |
| 3 | Artillery | Node-based, distributed via Lambda/Fargate (cost); heavier per-VU footprint. |
| 4 | Gatling / JMeter | JVM; overkill for a solo TS project. |

---

### ADR-14 — Observability stack: OpenTelemetry → Prometheus + Grafana + Tempo + Loki (Grafana Cloud free in cloud)

| Rank | Option | Reason |
|---|---|---|
| **1** | **OTel SDK (traces) + `prom-client` (metrics) + pino (logs) → Prometheus / Tempo / Loki / Grafana** locally; **Grafana Cloud Free** (10k series, 50 GB logs, 50 GB traces, 14-day retention) in cloud | Industry standard, vendor-neutral, free, one UI. KEDA reads the same Prometheus. |
| 2 | Elastic stack | Heavy on a 4 GB node; weaker metrics story. |
| 3 | Datadog / New Relic free tiers | Excellent UX but vendor lock-in and free tiers are host-limited; violates P5. |
| 4 | Sentry (errors only) | Complementary, optional (free 5k errors/mo). |

---

### ADR-15 — Cloud hosting for the reference deployment

Free tiers moved a lot in 2026; the table reflects the state verified on 2026-09-03.

| Rank | Option | Monthly cost | Fit | Notes |
|---|---|---|---|---|
| **1** | **Hetzner Cloud CAX11** (2 Arm vCPU, 4 GB, 40 GB NVMe, 20 TB traffic) running **k3s** + KEDA | **€5.99** (+ ~€0.50 IPv4; ex-VAT) | 5 | Reliable, real Kubernetes, arm64 images (Bun/ffmpeg fine). CX23 (x86, €5.49) if you prefer amd64. Prices rose in June 2026 — budget €6–7. |
| 2 | **Oracle Cloud Always Free** Ampere A1 (**now 2 OCPU / 12 GB** — halved on 2026-06-15), 200 GB block, 10 TB egress | **€0** | 4 | Still enough for k3s + API + 1–2 concurrent transcodes. Risks: chronic "Out of host capacity" on sign-up, idle-instance reclamation (< 20 % util over 7 days). Use if you can get an instance; design is identical. |
| 3 | Koyeb free instance (0.1 vCPU, 512 MB) / Render free web service | €0 | 2 | API only; both scale to zero (Koyeb after 1 h, Render after 15 min); neither offers free background workers; Render free Postgres expires after 30 days. Not viable for transcoding. |
| 4 | Fly.io | ~$2/mo per small machine, **no free tier** (trial only) | 3 | Nice Machines API for scale-to-zero workers, but no KEDA, and trial ends in days. |

**Managed pieces (all free):** Neon Postgres, Cloudflare R2 + CDN + DNS, Grafana Cloud, GitHub Actions + GHCR, Cloudflare Tunnel (expose the VPS without opening ports; Zero Trust free plan ≤ 50 seats).

**Total reference cost:** €0 (Oracle) or ≈ €6.5/month (Hetzner). Everything else is free tier.

---

### ADR-16 — Enqueue reliability: idempotent enqueue + reconciler (MVP), transactional outbox (Phase 4)

| Rank | Option | Status | Reason |
|---|---|---|---|
| **1 (Phase 4)** | **Transactional outbox** (`outbox` table written atomically with state changes; housekeeping relay polls `SKIP LOCKED` and publishes to BullMQ) | **Implemented** | Removes the dual-write window entirely; atomic with CAS state changes; relay ensures effectively-once publishing with deterministic job IDs; records older than 7 days pruned. |
| 2 (MVP) | Commit DB → enqueue with deterministic `jobId` → reconciler re-enqueues gaps | Superseded / Fallback | Reconciler remains as belt-and-braces fallback (`reconciler_repairs_total` stays 0 under normal outbox operation). |
| 3 | pg-boss (queue in Postgres) | Rejected | Solves it by construction, but loses BullMQ (ADR-03). |

---

### ADR-17 — Schema/validation & IDs

- **zod** (chosen) over TypeBox/ajv-only: one schema language for API bodies (`fastify-type-provider-zod`), job payloads (`packages/server/job-contracts`) and env parsing (`packages/server/env-schema`), with inferred TS types. TypeBox is faster at validation but the payloads are tiny.
- **UUIDv7** for `videoId`/`jobId` roots: time-ordered (index-friendly), unguessable enough for public playback paths, native `gen_uuid_v7()` in Postgres 17 / `uuidv7` package until then.

---

### ADR-18 — Error taxonomy decides retry policy

- `TransientError` (S3 5xx/timeouts, Redis hiccups, ffmpeg exit due to `SIGKILL`/OOM, disk full after cleanup) → BullMQ retry with backoff.
- `UnrecoverableError` (BullMQ built-in: corrupt container, unsupported codec, duration exceeded, source object missing) → **no retry**, straight to DLQ + `FAILED`.
- Unknown errors default to transient with a lower attempt cap (3) — "when unsure, retry a little, then park".

Decided once per code, in the vocabulary, not at the throw site: `RETRY_CLASS` in
`@vp/errors/src/retry-class.ts` is a `Readonly<Record<ErrorCode, 'permanent' | 'transient'>>`, so a new code
does not compile until it is classified. `instrument` in `apps/worker/src/composition/stages.module.ts` reads it to turn a stage's failed `Result`
into the `PermanentError` / `TransientError` BullMQ needs (ADR-24). Never by regex on messages.

---

### ADR-19 — Hexagonal Architecture, Interface Segregation, and Modular Repository Boundaries

- **Ports as Abstract Classes (`packages/server/core/ports/`, `packages/server/core/repositories/`)**:
  - Abstract classes extending `HealthCheckable` allow uniform `instanceof` checks, exception wrapping, and liveness contracts.
  - Driver/connection primitives (`DatabaseClient`) are segregated from domain entities (`Repositories`: `VideoRepository`, `UploadRepository`, `StepRepository`, `RenditionRepository`, `EventRepository`, `UserRepository`).
  - Standard object storage (`StorageClient`) is segregated from multipart chunk lifecycle (`MultipartStorage`).
- **Concrete SDK Isolation (`adapters/`)**:
  - `@aws-sdk/client-s3`, `ioredis`, `bullmq`, `postgres`, and `drizzle-orm` are strictly forbidden outside `adapters/` and composition roots (`apps/api/src/app.ts`, `apps/worker/src/runner.ts`).
  - Domain services, controllers, and worker stages depend purely on injected port interfaces.
- **Single Responsibility & File Length Discipline**:
  - Every repository implementation resides in its own dedicated file under `repositories/` (e.g. `packages/server/adapters/postgres/repositories/postgres-video-repository.ts`).
  - Monolithic multi-repository files are forbidden. Target file length: <= 250 lines (strict max 400 lines / ~10 KB).
- **Autonomous In-Memory Test Doubles (`packages/server/adapters/in-memory/`)**:
  - In-memory repositories encapsulate their state internally, provide a `.clear()` method, and communicate through port interfaces.
  - Enables in-process unit and end-to-end integration tests without Docker, real databases, or network sockets.

---

### ADR-20 — Monorepo Topology, Workspace Boundaries, and Contract Single-Sourcing

| Rank | Option | Status | Reason |
|---|---|---|---|
| **1** | **Single Monorepo (`video-pipeline`) with strict pnpm workspace boundaries (`apps/*`, `packages/<tier>/*`) + single-sourced Zod contracts (`@vp/api-contracts`)** | **Chosen** | Direct type-safety without build-time sync rituals or schema drift; `apps/web` consumes `@vp/api-client` with inferred route types; zero SDK leaks into frontend; backend route definitions share the identical schema; permissions (`@vp/permissions`, `universal` tier) shared between backend Fastify hooks and frontend UI guard components. |
| 2 | Separate Git repositories (backend repo vs frontend repo) with published NPM packages | Rejected | High ceremony, slow solo iteration, version mismatch risk, tedious local package linking during rapid API feature evolution. |
| 3 | Backend-only monorepo with tRPC for client-server RPC | Rejected | Couples API transport to tRPC runtime; prevents clean REST/OpenAPI standard documentation for public consumers, third-party integrations, and standard load testing tools (k6). |

**Consequences:**
- `apps/web` must **never** import `@vp/core`, `@vp/adapters`, `@vp/db` or any other `packages/server/*`
  package. Enforced three ways, strongest first: pnpm links only declared dependencies, so the import does
  not resolve; `pnpm boundaries` (`scripts/check-boundaries.ts`) rejects the manifest ahead of `pnpm build`
  and `pnpm typecheck`; and `tests/architecture/` asserts it from both the manifest graph
  (`package-boundaries.test.ts`) and the resolved lockfile (`lockfile-closure.test.ts`), which catches a
  transitive edge no import scan would see. See [ARCHITECTURE.md §6](../ARCHITECTURE.md).
- API endpoints are authored once in `packages/universal/api-contracts` (Zod) and compiled to OpenAPI schemas.
- `packages/client/api-client` generates TanStack React Query hooks and type-safe fetchers from `@vp/api-contracts`.

---

### ADR-21 — Modern Frontend Framework: React 19 + TanStack Start (SSR) + TanStack Router (No Next.js)

| Rank | Option | Status | Reason |
|---|---|---|---|
| **1** | **React 19 + TanStack Start (SSR/Streaming) + TanStack Router + Vite 6 + Tailwind CSS v4** | **Chosen** | 100% type-safe search params and route paths; streaming SSR without vendor lock-in to Vercel; perfect synergy with TanStack Query v5; client hydration and SSR play well with local-first Node/Docker deployment; no magic file conventions or Next.js server actions obfuscation. |
| 2 | Next.js 15 (App Router) | Rejected | Explicitly rejected by user requirement. Heavy Vercel coupling, opaque server component caching bugs, proprietary cache tags, heavy server footprint for self-hosting. |
---

### ADR-22 — High-Throughput Reaction Counters & Probabilistic Cache Refresh (XFetch)

| Rank | Option | Status | Reason |
|---|---|---|---|
| **1** | **Postgres normalized `video_reactions` + denormalized `videos` counter columns + Redis multi-tier cache with singleflight and XFetch probabilistic early refresh** | **Chosen** | Atomic transactions guarantee exact durability and consistency; Redis provides ultra-low latency reads for high-traffic video details; singleflight deduplicates concurrent cache misses preventing thundering herds; XFetch (`-beta * delta * ln(rand) > remaining_ttl`) smoothly refreshes popular video reaction counts asynchronously before expiration without thundering herd or cache stampede. |
| 2 | Pure Redis hyperloglog or counter with eventual writeback | Rejected | Loss of exact per-user reaction mapping (`GET /reactions/me`), potential data loss on Redis restart without durability, complex reconciliation. |
| 3 | Raw Postgres COUNT(*) query on every video detail view | Rejected | Catastrophic database load under peak traffic (O(N) row scanning over millions of reaction rows). |

**Consequences:**
- Mutations atomically update `video_reactions` and `videos(likes_count, dislikes_count)`.
- Redis stores `{ likes, dislikes, cachedAt, delta }` and updates atomically via Redis transaction (`pipeline`/`multi`) or atomic memory mutexes.
- Scheduled reconciler job `reconcile-reaction-counters` periodically detects and repairs counter drift.


### ADR-23 — Package Runtime Tiers: the Directory Is the Tier

| Rank | Option | Status | Reason |
|---|---|---|---|
| 1 | `packages/<tier>/<name>` — tier is the directory | **Accepted** | Unforgeable, readable by every tool, and a new package cannot be untiered |
| 2 | Flat `packages/*` with a `vp.tier` manifest field | Superseded | A field can be typo'd, copy-pasted or forgotten; nothing outside a bespoke script reads it |
| 3 | Convention and code review only | Rejected | This is what ADR-20 assumed, and `@vp/errors` still shipped a `bullmq` dependency to the browser |

**Context.** The repo began as API + worker, so every shared package was implicitly server-side. `apps/web`
arrived later by `git subtree` and nothing in the workspace recorded which packages a browser may import.
ADR-20 said boundaries were "enforced via ESLint/Biome import boundaries and CI build checks"; no such rule
and no such job existed. The result: `apps/web → @vp/permissions → @vp/errors → bullmq → ioredis`.

**Decision.** Two orthogonal, machine-checked properties per package.

*Tier* answers **where may this code run**, and it is the package's location: `packages/universal/`,
`packages/server/`, `packages/client/`. Apps sit outside `packages/` and declare their tier. A package is
`universal` only when something client-side actually consumes it — `storage`, `job-contracts` and `events`
were once declared universal with no client consumer, which put BullMQ queue names in the browser-safe tier.

*Layer* answers **which way may dependencies point**, declared as `vp.layer`: T1 foundation, T2 contracts and
policy, T3 domain capability, T4 integration, T5 applications, T6 reference tools that drive one. Dependencies
point **strictly down** — a T2 package may not depend on another T2. Sibling imports are forbidden because
they are how a layer quietly becomes a cycle. The layer is *declared* rather than derived from the graph: a
derived depth cannot contradict itself, which would make the check vacuous. `devDependencies` count: a
test-only edge resolves in CI and its types land in the emitted `.d.ts`, so only `@vp/tsconfig` and
`@vp/testing` — neither of which ships code — are exempt.

**Consequences:**
- An undeclared import does not resolve. pnpm links only declared dependencies, so a server import inside a
  universal package is `error TS2307` at compile time — impossible, not discouraged.
- `pnpm boundaries` validates tier compatibility, layer direction, tier-vs-directory agreement and
  `CLAUDE.md` symlink drift. `pnpm build` and `pnpm typecheck` run it first, so a bad *declaration* — the one
  thing TypeScript cannot catch — fails the build.
- `@vp/tsconfig` presets give `universal`/`client` packages `lib` with `DOM` and `types: []`, so a Node
  builtin is a type error.
- `tests/architecture/package-boundaries.test.ts` asserts the same rules in the unit suite.
- Package **names** are unchanged by the move, so no source import specifier changed; only `package.json`
  paths, tsconfig `extends`, turbo globs, Docker contexts and CI paths did.
- Changing a package's tier means moving it, which is a deliberate act rather than a one-word edit.

---

### ADR-24 — Result-Typed Error Handling: Domain Returns, the Edge Decides

**Context.** A failure was not part of any signature. `VideoService.get(user, id)` typed as
`Promise<VideoDetailView>`, could fail three ways, and the compiler knew about none of them, so adding a
fourth was a non-breaking change no caller handled. It also threw `VIDEO_NOT_FOUND` both for an absent row and
for a CASL refusal, so a service three layers below HTTP had decided that a private video looks like a missing
one and no second consumer could choose differently.

**Decision.** Domain code returns `Result<T, E>` from `@vp/result`; only the edge unwraps it.

- **Rules are pure and universal.** `@vp/validation` (T2) takes the input and nothing else and returns
  wire-safe `InputFailure`s; `@vp/domain-rules` (T3) takes input plus an entity plus policy. The split is what
  makes wire safety a *type* rather than a per-field judgement, and what lets a browser form run the backend's
  own rule before it makes a network call.
- **Ports and adapters return `Result`.** Absence is not a failure: `findById` answers `ok(null)`, because
  whether a missing row is an error is a domain decision. Every SDK call is wrapped at the exact line it is
  made, so a `catch` around ten statements can no longer hide which one failed.
- **The discriminant is the existing `ErrorCode`.** No second error vocabulary. `PROBLEM_STATUS` and
  `RETRY_CLASS` are both `Readonly<Record<ErrorCode, ...>>`, so a new code is a compile error until both edges
  have been told what it means.
- **Two edges.** `sendResult` in `apps/api/src/routes/` renders a `Problem`; `instrument` in `apps/worker/src/composition/stages.module.ts` converts to the BullMQ
  throw via `toPipelineError`, which reads `RETRY_CLASS`. `PermanentError` / `TransientError` remain, as the
  queue-boundary representation only (ADR-18).
- **A disguise is a rule, not a rendering.** The public route answers "you may not read this" with the same
  404 as "it does not exist", so the 403 cannot confirm the id. Which refusals get that treatment is a domain
  decision - a refusal to *edit* a video the caller can already see hides nothing - so `VideoForbidden` carries
  `readable` and `publicReadFailure` owns the disguise. Presenters call it; they do not re-derive it.

**Rejected alternatives.**

- **`neverthrow`.** A T1 universal package here carries zero runtime dependencies, must typecheck without
  `@types/node` and must pass under both `vitest` and `bun test`. The combinator set is ~120 lines we then own
  and shape to the `ErrorCode` discriminant, against a dependency in every browser bundle and a `ResultAsync`
  class that makes `await` illegal in half the codebase.
- **Exceptions plus a global handler only.** A global handler receives `unknown`, so it cannot be exhaustive,
  and it is one function for the whole app, so it cannot let two routes render the same failure differently -
  which is the requirement this ADR exists to satisfy. It stays, narrowed to a backstop for transport
  validation, rate limiting, auth pre-handlers and genuine bugs.
- **Go-style `[value, error]` tuples.** They do not narrow: nothing stops a caller reading `value` after a
  non-null `error`, and the union has no discriminant for a `switch` to be exhaustive over.

**Consequences.** Every port, repository, service and stage is converted. The three shrink-only allowlists
that carried the migration are gone and their assertions are flat: `result-returning-ports.test.ts`,
`no-domain-throw.test.ts` and `routes-unwrap-at-send-result.test.ts` simply fail on an offender.
No exception list is left: `catch-confinement.test.ts` allows a `catch` only in `@vp/result`, an adapter and
an entrypoint's exit-code handler, and `no-discarded-result.test.ts` fails on a `Result` left unread unless it
goes through `ignore(result, reason)`. Wire format is unchanged: a client cannot tell that the server
stopped throwing, apart from four additive codes.

`@vp/pagination` composes `@vp/result` to answer `Result<CursorPayload, InvalidCursor>` from its codec, which
moved it to T2 and carried `@vp/api-contracts` and `@vp/env-schema` to T3 and `@vp/config` to T4. A pipeline
stage reports a media verdict as `MediaFailure`, whose discriminant is the `PipelineErrorCode` the process
reported and which `RETRY_CLASS` already classifies.

Authority: [docs/standards/error-handling.md](standards/error-handling.md).

### ADR-25 — Composition: One Container, Configuration Is a Value

| Rank | Option | Status | Reason |
|---|---|---|---|
| 1 | Typed tokens and a hand-written `Container` (`@vp/composition`, server, T2) | **Accepted** | The token carries the type, so `get(VideoService)` types without a cast and a missing edge is a compile error; no dependency, no reflection, same behaviour under Node and Bun |
| 2 | A decorator container resolving by type (`@Injectable`, NestJS-style) | Rejected | Needs `emitDecoratorMetadata` plus a `reflect-metadata` polyfill in the eager path of both deployables; TC39 decorators carry no parameter types, so it pins the legacy flag indefinitely, and transpiler-level behaviour is what dual-runtime parity (Rule 2) exists to keep out. It also trades a compile error for a runtime one |
| 3 | Keep constructors with optional collaborators and in-service fallbacks | Rejected | Delete a line from the composition root and a different graph boots silently: that is a service locator wearing a constructor |

**Context.** `VideoService` recovered from a missing authorization port, paginator and CDN base by building
its own, reading `process.env` and reaching for a module-level default; four modules each stripped the CDN
base's trailing slash, one of them into an empty string. The declared bucket keys `S3_BUCKET_RAW` /
`S3_BUCKET_PUBLIC` were read by nothing while every consumer read an undeclared `STORAGE_*_BUCKET` and fell
through to the literal `raw`. `ADMIN_TOKEN` defaulted to a value published in this repository and admitted
anyone who sent it. The API installed no `SIGTERM` handler, and the worker inferred its adapter family from
`instanceof InMemoryJobQueue`.

**Decision.**

- **One mechanism.** `Token<T>`, `Container.provide / get / override / start / dispose`. A factory is
  synchronous; I/O a value needs before it is usable runs in its `start` hook, in construction order.
  `dispose()` runs in reverse construction order, aggregates failures, is idempotent, and releases only what
  a factory built, never an override. `shutdownOnce` is the drain both processes share.
- **Configuration is a value.** `loadEnv()` (`@vp/config`) parses `process.env` once at `main.ts`;
  `toAppConfig()` (`@vp/env-schema`, T3, so `@vp/adapters` at T4 can take it) shapes it into `AppConfig`.
  `CdnBase` is branded and normalised once. Nothing below `main.ts` reads the environment.
- **`AdapterKind` is the single environment switch.** `config.kind` is derived from `NODE_ENV` in
  `toAppConfig` and read once, by `registerAdapters(c, config)` in `@vp/adapters`, which imports only the
  chosen family so an external process never loads a test double.
- **Dependencies are total.** Every collaborator a composition module provides is required by the service
  or stage that takes it.
- **Registration surfaces.** `registerAdapters` (`@vp/adapters`), `apps/api/src/composition/services.module.ts`,
  `apps/worker/src/composition/stages.module.ts` and `STAGE_REGISTRY`, which carries each stage's processor
  factory. At the HTTP edge the container is Fastify's own: `app.decorate('services')` and
  `app.decorate('config')`, and every route module is a plugin registered from one table. Routes never see
  the application container.
- **Construction is not starting.** `buildApp()` resolves the graph and registers routes; `main.ts` calls
  `container.start()`, which subscribes the SSE hub and the category cache, registers the housekeeping
  schedulers and starts both metric pollers.
- **A process drains before it closes.** `SIGTERM` flips `/readyz` to 503 while the listener keeps
  accepting, closes the server after the drain delay, then disposes the container; a disposer that outlives
  the grace window is abandoned and named in the log. The API pod gets `terminationGracePeriodSeconds: 30`
  (5 s `preStop` + the process's 20 s grace window + 5 s before `SIGKILL`); each worker keeps the grace period
  §9.4 gives its stage, with a 5 s `preStop`, and its `shutdownTimeoutMs` is that period less 10 s. Compose
  sets `stop_signal: SIGTERM` and `stop_grace_period` = the process grace window + 5 s.

**Consequences.** `tests/architecture/` asserts the env-key closure in both directions, env confinement, no
defaulted secret, adapter instantiation, total dependencies, route plugins, drain-before-close, shutdown
closure and the in-memory-free boot path (ARCHITECTURE.md §6). Tests build services with exactly the
collaborators a case touches and build the app through `buildApp({ config, adapters })`, with
`inProcessAppConfig(overrides)` merging overrides in `AppConfig`'s shape.

## 5. Domain Model & Database Schema

### 5.1 Entity relationship

```mermaid
erDiagram
    users ||--o{ videos : owns
    users ||--o| channels : has
    videos ||--o| uploads : "has one"
    videos ||--o{ renditions : produces
    videos ||--o{ processing_steps : runs
    videos ||--o{ video_events : emits
    videos ||--o{ video_reactions : receives
    users ||--o{ video_reactions : reacts
    users ||--o{ channel_subscriptions : subscribes
    channels ||--o{ channel_subscriptions : has
    processing_steps ||--o{ dlq_entries : "may park in"

    users {
        uuid id PK
        text email UK
        text tier
    }
    channels {
        uuid id PK
        uuid user_id FK
        text handle UK
        text display_name
        text avatar_url
        text banner_url
        text bio
        int subscriber_count
        timestamptz created_at
        timestamptz updated_at
    }
    channel_subscriptions {
        uuid id PK
        uuid subscriber_id FK
        uuid channel_id FK
        timestamptz created_at
    }
    videos {
        uuid id PK
        uuid owner_id FK
        video_status status
        text source_key
        int duration_ms
        jsonb ladder
        text master_playlist_key
        text error_code
        int version
        int views_count
        int likes_count
        int dislikes_count
    }
    video_reactions {
        uuid id PK
        uuid video_id FK
        uuid user_id FK
        reaction_type type
        timestamptz created_at
        timestamptz updated_at
    }
    uploads {
        uuid id PK
        uuid video_id FK
        text strategy
        text multipart_upload_id
        bigint declared_size_bytes
        upload_status status
        timestamptz expires_at
    }
    renditions {
        uuid id PK
        uuid video_id FK
        text name
        rendition_status status
        text playlist_key
        int segment_count
        bigint bytes
    }
    processing_steps {
        uuid id PK
        uuid video_id FK
        text step
        text rendition
        text job_id
        int attempt
        step_status status
        uuid lock_token
        timestamptz heartbeat_at
    }
    video_events {
        bigint id PK
        uuid video_id FK
        text type
        jsonb payload
        text trace_id
    }
    dlq_entries {
        uuid id PK
        text queue
        text job_id
        uuid video_id FK
        jsonb payload
        text error_code
        int attempts_made
        text status
    }
```

### 5.2 DDL (Drizzle migration 0001 — authoritative excerpt)

```sql
CREATE TYPE video_status AS ENUM ('UPLOADING','UPLOADED','PROBING','PROCESSING','READY','FAILED','REJECTED','ABANDONED','DELETED');
CREATE TYPE upload_status AS ENUM ('OPEN','COMPLETED','ABORTED');
CREATE TYPE rendition_status AS ENUM ('PENDING','RUNNING','DONE','FAILED','SKIPPED');
CREATE TYPE step_status AS ENUM ('QUEUED','RUNNING','DONE','FAILED','DEAD');
CREATE TYPE user_role AS ENUM ('USER','CREATOR','MODERATOR','ADMIN');

CREATE TABLE users (
  id          uuid PRIMARY KEY,
  email       text NOT NULL UNIQUE,
  tier        text NOT NULL DEFAULT 'free',           -- drives job priority & quotas
  role        user_role NOT NULL DEFAULT 'USER',      -- RBAC/ABAC role
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE channels (
  id                uuid PRIMARY KEY,
  user_id           uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  handle            text NOT NULL UNIQUE,
  display_name      text NOT NULL,
  avatar_url        text,
  banner_url        text,
  bio               text,
  subscriber_count  integer NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX channels_handle_idx ON channels (handle);
CREATE INDEX channels_user_id_idx ON channels (user_id);

CREATE TABLE videos (
  id                  uuid PRIMARY KEY,               -- UUIDv7
  owner_id            uuid NOT NULL REFERENCES users(id),
  title               text NOT NULL DEFAULT '',
  description         text NOT NULL DEFAULT '',
  visibility          text NOT NULL DEFAULT 'private', -- private|unlisted|public
  status              video_status NOT NULL DEFAULT 'UPLOADING',
  source_key          text NOT NULL,                  -- raw/{id}/source.{ext}
  source_size_bytes   bigint,
  source_content_type text,
  duration_ms         integer,
  width               integer,
  height              integer,
  fps                 numeric(6,3),
  video_codec         text,
  audio_codec         text,
  ladder              jsonb,                          -- [{"name":"720p","width":1280,"height":720,"videoKbps":2800,"audioKbps":128}]
  master_playlist_key text,
  poster_key          text,
  sprite_key          text,
  error_code          text,
  error_message       text,
  version             integer NOT NULL DEFAULT 0,     -- optimistic lock for metadata edits
  ready_at            timestamptz,
  deleted_at          timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX videos_owner_created_idx ON videos (owner_id, created_at DESC);
CREATE INDEX videos_status_updated_idx ON videos (status, updated_at);   -- reconciler scans

CREATE TABLE uploads (
  id                    uuid PRIMARY KEY,
  video_id              uuid NOT NULL UNIQUE REFERENCES videos(id) ON DELETE CASCADE,
  strategy              text NOT NULL,                -- single|multipart
  multipart_upload_id   text,
  part_size_bytes       integer,
  parts_expected        integer,
  declared_size_bytes   bigint NOT NULL,
  declared_content_type text NOT NULL,
  sha256                text,
  status                upload_status NOT NULL DEFAULT 'OPEN',
  expires_at            timestamptz NOT NULL,
  completed_at          timestamptz
);

CREATE TABLE renditions (
  id                 uuid PRIMARY KEY,
  video_id           uuid NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  name               text NOT NULL,                   -- 1080p|720p|480p
  width              integer NOT NULL,
  height             integer NOT NULL,
  video_bitrate_kbps integer NOT NULL,
  audio_bitrate_kbps integer NOT NULL,
  status             rendition_status NOT NULL DEFAULT 'PENDING',
  playlist_key       text,
  segment_count      integer,
  bytes              bigint,
  processing_ms      integer,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (video_id, name)                             -- idempotent upsert target
);

CREATE TABLE processing_steps (
  id            uuid PRIMARY KEY,
  video_id      uuid NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  step          text NOT NULL,                        -- probe|transcode|thumbnail|package|notify
  rendition     text NOT NULL DEFAULT '-',            -- '-' when not rendition-scoped (part of the unique key)
  job_id        text NOT NULL,
  attempt       integer NOT NULL DEFAULT 1,
  status        step_status NOT NULL DEFAULT 'QUEUED',
  worker_id     text,
  lock_token    uuid,                                 -- fencing token (§9.5)
  started_at    timestamptz,
  heartbeat_at  timestamptz,
  finished_at   timestamptz,
  error_code    text,
  error_message text,
  result        jsonb,
  UNIQUE (video_id, step, rendition)
);

CREATE TABLE video_events (                            -- append-only; never UPDATE/DELETE
  id         bigserial PRIMARY KEY,
  video_id   uuid NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  type       text NOT NULL,                           -- upload.completed, probe.started, transcode.progress, …
  payload    jsonb NOT NULL DEFAULT '{}',
  trace_id   text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX video_events_video_idx ON video_events (video_id, id);

CREATE TABLE dlq_entries (
  id            uuid PRIMARY KEY,
  queue         text NOT NULL,
  job_id        text NOT NULL,
  video_id      uuid REFERENCES videos(id) ON DELETE SET NULL,
  payload       jsonb NOT NULL,
  error_code    text,
  error_message text,
  stack         text,
  attempts_made integer NOT NULL,
  worker_id     text,
  status        text NOT NULL DEFAULT 'PARKED',       -- PARKED|REPLAYED|DISCARDED
  created_at    timestamptz NOT NULL DEFAULT now(),
  replayed_at   timestamptz,
  UNIQUE (queue, job_id, attempts_made)
);

CREATE TABLE channel_subscriptions (
  id            uuid PRIMARY KEY,
  subscriber_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel_id    uuid NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (subscriber_id, channel_id)
);
CREATE INDEX channel_subscriptions_subscriber_idx ON channel_subscriptions (subscriber_id, created_at DESC);
CREATE INDEX channel_subscriptions_channel_idx ON channel_subscriptions (channel_id, created_at DESC);
```

Why `dlq_entries` exists in Postgres when BullMQ already has a `dlq` queue: Redis is not the truth (P2). The Postgres mirror survives Redis loss, is queryable ("all DLQ entries for codec X this week"), and gives the admin UI a stable, paginated view. The Redis `dlq` queue holds the replayable job; the table holds the record.

### 5.3 Key queries that encode the guarantees

```sql
-- Compare-and-set transition (returns 0 rows if someone else moved it first)
UPDATE videos SET status = 'PROBING', updated_at = now()
WHERE id = $1 AND status = 'UPLOADED';

-- Idempotent step claim: first attempt inserts; a retry bumps attempt and takes a new fencing token
INSERT INTO processing_steps (id, video_id, step, rendition, job_id, attempt, status, worker_id, lock_token, started_at, heartbeat_at)
VALUES ($1, $2, 'transcode', '720p', $3, $4, 'RUNNING', $5, $6, now(), now())
ON CONFLICT (video_id, step, rendition) DO UPDATE
  SET attempt = EXCLUDED.attempt, status = 'RUNNING', worker_id = EXCLUDED.worker_id,
      lock_token = EXCLUDED.lock_token, started_at = now(), heartbeat_at = now(), error_code = NULL
  WHERE processing_steps.status <> 'DONE'            -- never re-open a finished step
RETURNING lock_token;

-- Fenced completion: only the holder of the current token may finish the step
UPDATE processing_steps SET status = 'DONE', finished_at = now(), result = $3
WHERE video_id = $1 AND step = 'transcode' AND rendition = '720p' AND lock_token = $2;

-- Reconciler: videos that were marked UPLOADED but never got a probe step
SELECT v.id FROM videos v
LEFT JOIN processing_steps s ON s.video_id = v.id AND s.step = 'probe'
WHERE v.status = 'UPLOADED' AND v.updated_at < now() - interval '5 minutes' AND s.id IS NULL
FOR UPDATE SKIP LOCKED LIMIT 100;
```

---

## 6. API Contract

Base path `/v1`. JSON everywhere except SSE. Auth: `Authorization: Bearer <JWT>` (RS256/EdDSA, verified against `AUTH_JWKS_URL`; a token signed with the public `packages/server/dev-token` seed is accepted only outside production). Errors follow RFC 9457 `application/problem+json` with a stable `code`.

### 6.1 Endpoints

| Method & path | Purpose | Request | Response | Notes |
|---|---|---|---|---|
| `POST /uploads` | Start upload | `{ filename, sizeBytes, contentType, sha256? , title? }` | `201 { videoId, uploadId, strategy, partSizeBytes, parts:[{partNumber,url,expiresAt}], singleUrl?, expiresAt }` | ≤ 100 MB → `single` (one presigned PUT). Else multipart; first 100 part URLs inline. Rate limit 30/min/user. |
| `GET /uploads/:uploadId` | Resume info | — | `200 { status, partSizeBytes, partsExpected, uploadedParts:[{partNumber, etag, size}] }` | Backed by `ListParts`. |
| `POST /uploads/:uploadId/parts?from=&count=` | More part URLs | — | `200 { parts:[…] }` | `count ≤ 100`. |
| `POST /uploads/:uploadId/complete` | Finish | `{ parts:[{partNumber, etag}] }` (multipart) or `{}` (single) | `202 { videoId, status:"UPLOADED" }` or `422 { code:"UPLOAD_SIZE_MISMATCH" \| "UPLOAD_TOO_LARGE" \| "UNSUPPORTED_CONTENT_TYPE" }` | Idempotent: second call returns 202 with current status. |
| `DELETE /uploads/:uploadId` | Abort | — | `204` | `AbortMultipartUpload`, video → `ABANDONED`. |
| `GET /videos?cursor=&limit=&status=` | List mine | — | `200 { items:[VideoSummary], nextCursor }` | Keyset pagination on `(created_at, id)`. |
| `GET /feed?sort=&categoryId=&cursor=&limit=` | Public video feed | — | `200 { items:[VideoSummary], nextCursor, total }` | Unauthenticated public feed. Multi-sort (recent, popular, trending) & categoryId filter, single-sourced in `packages/universal/domain/src/public-feed.ts` and translated by each adapter. Trending ranks on `(views_count + 1) / (ageHours + 2) ^ 1.5`. Cached in Redis with singleflight & ETag 304. |
| `GET /v1/categories` | Public categories list | — | `200 [Category]` | Unauthenticated active taxonomy list sorted by sort_order, name. L1/L2 cached + ETag 304. |
| `GET /videos/:id` | Detail | — | `200 Video` (status, progress, ladder, `playbackUrl`, `posterUrl`, `spriteUrl`, `renditions[]`, `likesCount`, `dislikesCount`, `error?`) | Owner or public/unlisted. |
| `PUT /videos/:id/reactions` | Set/clear reaction | `{ type: "LIKE" \| "DISLIKE" \| "NONE" }` | `200 { videoId, likesCount, dislikesCount, userReaction }` | Authenticated caller (`video:react`). Atomically updates Postgres and Redis counters. |
| `GET /videos/:id/reactions/me` | My reaction | — | `200 { videoId, type: "LIKE" \| "DISLIKE" \| null }` | Authenticated caller. |
| `POST /channels/:id/subscribers` | Subscribe | — | `200 { channelId, subscriberCount, subscribed: true }` | Authenticated caller (`channel:subscribe`). Idempotent. Cannot subscribe to own channel (400 `CANNOT_SUBSCRIBE_TO_SELF`). |
| `DELETE /channels/:id/subscribers` | Unsubscribe | — | `200 { channelId, subscriberCount, subscribed: false }` | Authenticated caller (`channel:subscribe`). Idempotent. Atomic DB mutation + Redis set sync. |
| `GET /channels/:id/subscribers/me` | Check subscription | — | `200 { channelId, subscribed: boolean }` | Authenticated caller. Served from the Redis O(1) set; a miss primes the whole set from Postgres. |
| `GET /me/subscriptions?cursor=&limit=` | Subscribed channels | — | `200 { items:[SubscribedChannelItem], nextCursor }` | Authenticated caller. Keyset pagination on `(created_at, channel_id)`. |
| `GET /feed/subscriptions?cursor=&limit=` | Subscribed video feed | — | `200 { items:[VideoSummary], nextCursor, total }` | Authenticated caller. Keyset pagination on `(created_at, id)` for `READY` + `public` videos. |
| `PATCH /videos/:id` | Edit metadata | `{ title?, description?, visibility?, version }` | `200 Video` / `409 VERSION_CONFLICT` | Optimistic lock on `version`. |
| `DELETE /videos/:id` | Soft delete | — | `202` | Enqueues `housekeeping:purge-video`. |
| `GET /videos/:id/events` | SSE stream | header `Last-Event-ID?` | `text/event-stream` | See §10. |
| `GET /me/events` | SSE for all my videos | — | `text/event-stream` | Channel `user:{userId}`. |
| `POST /videos/:id/reprocess` | Re-run pipeline | `{ renditions?: ["720p"] }` | `202` | Owner (rate-limited) or admin. |
| **Admin** (`x-admin-token` or admin role) | | | | |
| `POST /v1/admin/categories` | Create category | `{ name, slug, description?, iconUrl?, sortOrder?, isActive? }` | `201 Category` / `409 CATEGORY_SLUG_CONFLICT` | Invalidates L1/L2 category cache across pods. |
| `PATCH /v1/admin/categories/:id` | Update category | `{ name?, slug?, description?, iconUrl?, sortOrder?, isActive? }` | `200 Category` / `404` / `409` | Invalidates L1/L2 category cache across pods. |
| `DELETE /v1/admin/categories/:id` | Delete category | — | `204` / `404` / `409 CATEGORY_IN_USE` | Checks video usage. Invalidates L1/L2 cache. |
| `GET /v1/admin/videos/:id` | Read a video as an operator | — | `200 Video` / `403 FORBIDDEN` / `404` | Same `VideoService.get` call as `GET /videos/:id`; renders `FORBIDDEN` as a detailed 403 where the public route disguises it as 404 (ADR-24). |
| `GET /admin/queues/*` | Bull Board UI | — | HTML | `@bull-board/fastify`. |
| `GET /admin/dlq?cursor=` | List DLQ | — | `200 { items:[DlqEntry] }` | From Postgres mirror. |
| `POST /admin/dlq/:id/replay` | Replay | `{ resetAttempts?: true }` | `202` | Re-adds to origin queue with fresh `jobId` suffix `--r{n}`; audit event. |
| `DELETE /admin/dlq/:id` | Discard | — | `204` | |
| **Ops** | | | | |
| `GET /healthz` | Liveness | — | `200` | Process up. |
| `GET /readyz` | Readiness | — | `200/503` | Postgres `SELECT 1`, Redis `PING`, S3 `HeadBucket` (cached 10 s). |
| `GET /metrics` | Prometheus | — | text | Bound to a separate port (`METRICS_PORT`) so it is never public. |
| `GET /docs` | OpenAPI UI | — | HTML | Generated from zod schemas via `@fastify/swagger`. |

### 6.1.1 Keyset pagination & cursors

Every paginated endpoint shares one mechanism, in `@vp/pagination`, rather than
re-deriving page maths per service:

- **`Paginator`** owns the page bounds and the cursor codec. `limit(requested)` clamps a
  request into `[1, maxLimit]`; `paginate(rows, limit, { cursorOf, toItem })` trims the
  window and mints the next cursor.
- **Repositories return `limit + 1` rows.** That extra row is the only evidence a further
  page exists; it is trimmed before the response and never reaches the client. Repositories
  never encode a cursor — the wire format is a transport concern.
- **`CursorCodec` is pluggable.** `Base64UrlCursorCodec` (default) renders the keyset as an
  opaque URL-safe token; `JsonCursorCodec` renders it readable for tests and debugging.
  Swapping the codec changes no call site. It uses `btoa`/`atob` rather than `Buffer`, so the
  same code runs under Node, Bun and the browser.
- **Bounds are configuration over one shared default.** `@vp/pagination` exports
  `PAGE_SIZE_DEFAULT` (20) and `PAGE_SIZE_MAX` (100); `@vp/api-contracts` builds
  `PageLimitSchema` from them and `@vp/env-schema` uses them as the defaults of the env keys of
  the same name, which the composition root (`apps/api/src/app.ts`) reads once and injects.
  Tests and callers override by passing their own `Paginator`.
- **A lower configured maximum clamps, it does not reject.** `PAGE_SIZE_MAX=50` leaves the
  published contract advertising 100 and a request for 100 still succeeds — the page simply
  comes back with 50 items and `nextCursor` walks the remainder. The maximum is an operational
  valve protecting the database, not part of the wire contract, so turning it down is not a
  breaking API change. `PageLimitSchema`'s OpenAPI description says so where a client reads it.

- **A feed cursor carries rank inputs, never a rank.** The public feed payload is
  `{ createdAt, viewsCount, instant, id }` for every sort: each adapter recomputes the
  cursor row's rank in its own arithmetic, so a Postgres `double precision` is never
  compared against one JavaScript produced — the two disagree by an ULP often enough to
  repeat the cursor row at every page boundary. `instant` is the bucketed clock sample the
  first page ranked against; later pages take it back off the cursor instead of re-sampling,
  which keeps a trending walk consistent across the 30 s feed cache.

A malformed cursor raises `InvalidCursorError` in core, which the API layer translates into
`400 VALIDATION_FAILED`.

### 6.2 Error codes (stable, machine-readable)

`UPLOAD_TOO_LARGE`, `UPLOAD_SIZE_MISMATCH`, `UNSUPPORTED_CONTENT_TYPE`, `UPLOAD_EXPIRED`, `UPLOAD_NOT_OPEN`, `QUOTA_EXCEEDED`, `VIDEO_NOT_FOUND`, `DLQ_ENTRY_NOT_FOUND`, `VERSION_CONFLICT`, `FORBIDDEN`, `RATE_LIMITED`, `UNAUTHORIZED`, `VALIDATION_FAILED`, `INVALID_CURSOR`, `CATEGORY_NOT_FOUND`, `CATEGORY_SLUG_CONFLICT`, `CATEGORY_IN_USE`, `CHANNEL_NOT_FOUND`, `HANDLE_ALREADY_TAKEN`, `INVALID_HANDLE_FORMAT`, `CANNOT_SUBSCRIBE_TO_SELF`, `DATABASE_UNAVAILABLE`, `CACHE_UNAVAILABLE`, `QUEUE_UNAVAILABLE`, `INTERNAL` (API) · `UNSUPPORTED_CODEC`, `CORRUPT_CONTAINER`, `DURATION_EXCEEDED`, `SOURCE_MISSING`, `FFMPEG_FAILED`, `FFMPEG_OOM`, `FFMPEG_TIMEOUT`, `STORAGE_UNAVAILABLE`, `SEGMENT_VERIFY_FAILED`, `DISK_FULL`, `ORPHANED` (pipeline; ORPHANED marks a video the processing reconciler found with nothing running and nothing queued).

A code is declared in `@vp/errors` and carries two properties, each declared once over the whole `ErrorCode` union so that adding a code fails to compile until both are decided:

| Property | Map | Lives in |
|---|---|---|
| the HTTP status it is reported as | `PROBLEM_STATUS` | `@vp/api-contracts/src/problem.ts` |
| `'permanent'` or `'transient'` (ADR-18) | `RETRY_CLASS` | `@vp/errors/src/retry-class.ts` |

Those two maps are the authority; this list is the enumeration, and `tests/architecture/error-code-drift.test.ts` fails if they disagree.

### 6.3 Video resource (response shape)

```ts
type Video = {
  id: string; title: string; description: string; visibility: 'private'|'unlisted'|'public';
  status: 'UPLOADING'|'UPLOADED'|'PROBING'|'PROCESSING'|'READY'|'FAILED'|'REJECTED'|'ABANDONED'|'DELETED';
  progress: { overall: number; byRendition: Record<string, number> };   // 0–100
  durationMs?: number; width?: number; height?: number; fps?: number;
  ladder?: Array<{ name: string; width: number; height: number; videoKbps: number; audioKbps: number }>;
  renditions: Array<{ name: string; status: string; playlistUrl?: string }>;
  playbackUrl?: string; posterUrl?: string; spriteUrl?: string; spriteVttUrl?: string;
  error?: { code: string; message: string };
  version: number; createdAt: string; updatedAt: string; readyAt?: string;
};
```

### 6.4 API Layer Architecture: Thin Transport Routes & Domain Services

To maintain strict modularity, testability, and separation of concerns, the API layer enforces a strict two-tier architecture:

1. **Routes (`apps/api/src/routes/`) — Thin HTTP Transport Adapters**:
   - Sole responsibilities: Fastify route definitions, Zod schema validation (`params`, `query`, `body`), authentication extraction (`requireAuth`, or `request.user` on endpoints that also serve anonymous callers), delegating execution directly to a domain service that decides authorization through `AuthorizationPort`, and returning HTTP response codes/headers.
   - Invariant: Route handlers MUST NEVER invoke repositories directly, perform business logic, execute transactions, or manage entity lifecycles.
   - A route hands the service's `Result` to `sendResult(reply, request, result, options?)`, the only place in `apps/api` where one is unwrapped (ADR-24). Its default mapping is total over `ErrorCode` through `PROBLEM_STATUS`, so a route wanting the standard response passes nothing; `options.on` overrides one code for one route, and a `*.presenter.ts` module owns a whole union with `assertNever` in its `default`.
2. **Services (`apps/api/src/services/`) — Deep Domain Services & Composition**:
   - Encapsulate business logic, domain invariants, repository coordination, cache management (e.g. L1/L2 multi-tier caching and invalidation), and error classification.
   - Completely decoupled from Fastify; fully unit-testable in isolation using in-memory port doubles (`InMemoryRepositories`, `InMemoryCacheClient`, `InMemoryStorageClient`).
   - Every domain resource (`videos`, `uploads`, `channels`, `categories`, `dlq`, `queues`) has its own dedicated service (`VideoService`, `UploadService`, `ChannelService`, `CategoryService`, `DlqService`, `QueueService`).
   - Collaborators are injected and required; `composition/services.module.ts` builds them (ADR-25). Route modules are Fastify plugins that read `app.services`.

---

## 7. Object Storage Layout

Two buckets, deterministic keys, no per-request randomness — this is what makes re-running any step safe.

```
raw/                                   (private; lifecycle: expire objects after 7 days; abort incomplete multipart after 1 day)
└── {videoId}/
    └── source.{ext}                   ← original upload

public/                                (private bucket, public read via CDN custom domain; lifecycle: none)
└── videos/{videoId}/
    ├── hls/
    │   ├── master.m3u8                ← written last by `package`; presence == READY
    │   ├── 1080p/
    │   │   ├── index.m3u8
    │   │   └── seg_00001.ts … seg_NNNNN.ts
    │   ├── 720p/ …
    │   └── 480p/ …
    ├── thumbs/
    │   ├── poster.jpg                 (1280×720)
    │   ├── sprite.jpg                 (10×N grid of 160×90 frames, 1 frame / 5 s)
    │   └── sprite.vtt                 (WebVTT thumbnails with #xywh= fragments)
    └── meta.json                      (probe output snapshot; debugging aid)
```

Rules:

- Segment naming is zero-padded and derived from FFmpeg's `%05d` — a retry overwrites identical keys with identical bytes (same encoder settings, same source, deterministic `-fflags +bitexact` where practical).
- Every writer uses `Content-Type` (`application/vnd.apple.mpegurl`, `video/MP2T`, `image/jpeg`, `text/vtt`) and `Cache-Control` (`public, max-age=60` for playlists, `public, max-age=31536000, immutable` for segments and images).
- A re-process that changes the ladder writes into a new *generation* prefix `hls/g{n}/` and `master_playlist_key` is switched atomically in the DB; the old generation is purged by housekeeping. MVP: `g1` implied (no prefix); the generation column exists from day one.
- Local dev: MinIO console at `:9001`; the `public` bucket gets an anonymous `download` policy so hls.js can fetch directly from `http://localhost:9000/public/...`.

---

## 8. Media Processing (FFmpeg) Specification

FFmpeg 7.x static build inside the worker image (`jrottenberg/ffmpeg:7-ubuntu` layer or `apt install ffmpeg` on Debian 13; multi-arch). Everything below is wrapped by `packages/server/ffmpeg` which builds argv arrays (never shell strings) and parses `-progress pipe:1`.

### 8.1 Probe

```bash
ffprobe -v error -print_format json -show_format -show_streams -show_error \
  -i "$SOURCE_URL"           # presigned GET URL, or a local path after a range-limited download
```

Validation rules (→ `UnrecoverableError` codes): no video stream → `CORRUPT_CONTAINER`; `codec_name` not in `{h264,hevc,vp9,av1,mpeg4}` → `UNSUPPORTED_CODEC`; `duration > MAX_DURATION_SEC` → `DURATION_EXCEEDED`; width/height ≤ 0 or > 7680 → `CORRUPT_CONTAINER`. Rotation from `side_data_list` / `tags.rotate` is honoured (swap width/height for ladder selection; ffmpeg autorotates on transcode).

Ladder selection: candidates below, keep those with `height ≤ sourceHeight` (rotated-aware), always keep at least the smallest rung.

| Name | Resolution (max, keep AR) | Video kbps (maxrate / bufsize) | Audio | Profile / level | Approx CPU weight |
|---|---|---|---|---|---|
| 1080p | 1920×1080 | 5000 (5350 / 7500) | AAC-LC 128k, 48 kHz | High @ 4.1 | 2.5 |
| 720p | 1280×720 | 2800 (2996 / 4200) | AAC-LC 128k | High @ 3.1 | 1.2 |
| 480p | 854×480 | 1400 (1498 / 2100) | AAC-LC 96k | Main @ 3.1 | 0.6 |

(Bitrates follow the Apple HLS authoring guidance ranges; tune after Phase 3 measurements.)

### 8.2 Transcode one rendition to HLS (TS segments)

```bash
ffmpeg -hide_banner -nostdin -loglevel error -progress pipe:1 \
  -i "$SOURCE" \
  -map 0:v:0 -map 0:a:0? \
  -vf "scale=w=1280:h=720:force_original_aspect_ratio=decrease:force_divisible_by=2" \
  -c:v libx264 -preset veryfast -profile:v high -level 3.1 -pix_fmt yuv420p \
  -b:v 2800k -maxrate 2996k -bufsize 4200k \
  -g 48 -keyint_min 48 -sc_threshold 0 \
  -force_key_frames "expr:gte(t,n_forced*2)" \
  -c:a aac -b:a 128k -ac 2 -ar 48000 \
  -f hls -hls_time 6 -hls_playlist_type vod -hls_flags independent_segments+temp_file \
  -hls_segment_type mpegts -hls_segment_filename "$OUT/seg_%05d.ts" \
  -threads "$FFMPEG_THREADS" \
  "$OUT/index.m3u8"
```

Notes that matter for correctness at scale:

- **Keyframe alignment across renditions** (`-force_key_frames expr:gte(t,n_forced*2)` + `-sc_threshold 0` + `-g` = 2 s × fps) is what makes ABR switching seamless; `-g 48` assumes 24 fps — `packages/server/ffmpeg` computes `g = round(2 * fps)` from probe.
- `independent_segments` + `temp_file` guarantee each `.ts` starts with an IDR and is only renamed into place when complete → the uploader can safely tail the directory and upload segments as they close (`chokidar`/`fs.watch` on rename), keeping local disk usage bounded (delete after successful upload).
- `-preset veryfast` is the MVP quality/speed point; expose as `X264_PRESET` for the load tests (measure `veryfast` vs `fast`).
- `FFMPEG_THREADS` = container CPU limit (K8s `resources.limits.cpu`), so one job saturates its pod and concurrency stays 1 per pod (§9.4).
- Source access & disk bound (Ticket 14): for MVP the worker downloads the source once to local disk (simple, seekable — ffmpeg seeks the `moov` atom for MP4); an optional **streaming variant** (`-i https://presigned-url`, enabled via `TRANSCODE_STREAMING_INPUT=true` or `job.data.streamingInput=true`) is available as the low-disk fallback. Local disk requirement is strictly bounded: peak disk usage never exceeds `sourceSize + 3 × maxSegmentBytes` (measured on 60s/30-minute sources: source file + at most 3 segments in flight ≈ sourceSize + ~3.5 MB segments, or ~3.5 MB total with streaming input; local temp directory is guaranteed cleaned on completion and on forced failure).

### 8.3 Thumbnails

```bash
# poster at 10% of duration (fallback: first frame if duration unknown), 1280x720 letterboxed
ffmpeg -ss "$T10" -i "$SOURCE" -frames:v 1 -vf "thumbnail,scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2" -q:v 3 "$OUT/poster.jpg"
# sprite sheet: one 160x90 frame every 5 s, 10 columns
ffmpeg -i "$SOURCE" -vf "fps=1/5,scale=160:90:force_original_aspect_ratio=decrease,pad=160:90:(ow-iw)/2:(oh-ih)/2,tile=10x${ROWS}" -frames:v 1 -q:v 5 "$OUT/sprite.jpg"
```

`sprite.vtt` is generated in TypeScript from `durationMs` (`00:00:00.000 --> 00:00:05.000` / `sprite.jpg#xywh=0,0,160,90`, …).

### 8.4 Master playlist (generated by `package`, not by ffmpeg)

```
#EXTM3U
#EXT-X-VERSION:6
#EXT-X-INDEPENDENT-SEGMENTS
#EXT-X-STREAM-INF:BANDWIDTH=5350000,AVERAGE-BANDWIDTH=5128000,RESOLUTION=1920x1080,FRAME-RATE=24.000,CODECS="avc1.640029,mp4a.40.2"
1080p/index.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=2996000,AVERAGE-BANDWIDTH=2928000,RESOLUTION=1280x720,FRAME-RATE=24.000,CODECS="avc1.64001f,mp4a.40.2"
720p/index.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=1498000,AVERAGE-BANDWIDTH=1496000,RESOLUTION=854x480,FRAME-RATE=24.000,CODECS="avc1.4d401f,mp4a.40.2"
480p/index.m3u8
```

`BANDWIDTH` = peak (`maxrate` + audio); `AVERAGE-BANDWIDTH` = measured (`bytes*8/duration`) from the rendition result; `CODECS` derived from profile/level (`avc1.64xxyy`). Renditions are listed highest-first; hls.js starts at the first entry unless `startLevel` is set — the frontend can pick 480p as the initial level for time-to-first-frame.

### 8.5 Chunked parallel transcoding (Phase 4 stretch — designed, not built)

1. `probe` decides `chunkSeconds = 30` for sources > 5 min.
2. `split` stage: `ffmpeg -i src -c copy -map 0 -f segment -segment_time 30 -reset_timestamps 1 -segment_format mp4 chunk_%03d.mp4` (splits only at existing keyframes — chunk lengths vary; fine).
3. Flow: `package` ← `concat-{rendition}` ← `transcode-chunk-{rendition}` × N. Each chunk job transcodes with the same ladder settings **plus** `-force_key_frames` relative to chunk start; audio is transcoded once from the full source to avoid seam artefacts and muxed at concat.
4. `concat-{rendition}` uses `-f concat -safe 0 -i list.txt -c copy` then re-segments to HLS with `-c copy -f hls`.
5. Job contract already carries `chunkIndex?/chunkCount?` so no schema change is needed.

---

## 9. Distributed Queue & Worker Design (deep dive)

### 9.1 Queue topology

BullMQ has no exchanges; a *queue* is the routing unit and Redis key prefix. One queue per stage, one per rendition for transcodes so each can be scaled and rate-limited independently.

| Queue (BullMQ name) | Producer | Consumer stage | Concurrency / pod | Attempts | Backoff | Lock duration | Typical duration |
|---|---|---|---|---|---|---|---|
| `probe` | API (`complete`), reconciler, reprocess | `probe` | 4 | 5 | exp 5 s, jitter 0.5 | 60 s | 1–10 s |
| `transcode-1080p` | probe (as Flow child) | `transcode-1080p` | 1 | 4 | exp 10 s, jitter 0.5 | 120 s | 1–25 min |
| `transcode-720p` | probe | `transcode-720p` | 1 | 4 | exp 10 s | 120 s | 0.5–12 min |
| `transcode-480p` | probe | `transcode-480p` | 1 (or 2) | 4 | exp 10 s | 120 s | 0.3–6 min |
| `thumbnail` | probe | `thumbnail` | 2 | 4 | exp 5 s | 60 s | 5–60 s |
| `package` | probe (Flow parent) | `package` | 4 | 5 | exp 5 s | 60 s | 1–5 s |
| `notify` | package, failure handler | `notify` | 8, **rate limit 100/10 s** | 8 | exp 2 s | 30 s | < 1 s |
| `housekeeping` | Job Schedulers (cron) | `housekeeping` | 1 | 3 | fixed 60 s | 300 s | seconds–minutes |
| `dlq` | `failed` handlers | *none* (admin replay only) | — | — | — | — | — |

Redis key shape: `bull:{queue}:wait` (LIST), `:prioritized` (ZSET), `:active`, `:delayed` (ZSET), `:completed`, `:failed`, `:events` (STREAM), `:meta`, plus `:{jobId}` hashes. Queue names must not contain `:`.

Job options applied by `packages/server/job-contracts` factory functions (never hand-written at call sites):

```ts
// packages/server/job-contracts/src/options.ts
export const defaultJobOptions = {
  removeOnComplete: { age: 24 * 3600, count: 5000 },     // keep for Bull Board, cap memory
  removeOnFail:     { age: 7 * 24 * 3600 },              // failed jobs stay a week (DLQ mirror in Postgres anyway)
} satisfies JobsOptions;

export const stagePolicies = {
  'probe':          { attempts: 5, backoff: { type: 'exponential', delay: 5_000,  jitter: 0.5 }, priority: 5 },
  'transcode-1080p':{ attempts: 4, backoff: { type: 'exponential', delay: 10_000, jitter: 0.5 } },
  'transcode-720p': { attempts: 4, backoff: { type: 'exponential', delay: 10_000, jitter: 0.5 } },
  'transcode-480p': { attempts: 4, backoff: { type: 'exponential', delay: 10_000, jitter: 0.5 } },
  'thumbnail':      { attempts: 4, backoff: { type: 'exponential', delay: 5_000,  jitter: 0.5 } },
  'package':        { attempts: 5, backoff: { type: 'exponential', delay: 5_000,  jitter: 0.5 } },
  'notify':         { attempts: 8, backoff: { type: 'exponential', delay: 2_000,  jitter: 0.3 } },
  'housekeeping':   { attempts: 3, backoff: { type: 'fixed', delay: 60_000 } },
} as const;
```

Exponential with `delay: 10 s` gives 10 s → 20 s → 40 s (+ jitter) between four attempts — long enough for a storage blip to pass, short enough that a video is not stuck for an hour.

### 9.2 Job identity & payload contracts

Deterministic IDs are the first line of idempotency: BullMQ ignores an `add()` whose `jobId` already exists in the queue (any state except removed). IDs use `--` as separator because `:` is forbidden.

| Job | `jobId` | Payload (zod, see §20) |
|---|---|---|
| probe | `${videoId}--probe--g${generation}` | `{ videoId, sourceKey, generation, traceparent }` |
| transcode | `${videoId}--transcode--720p--g${generation}` | `{ videoId, sourceKey, generation, rendition: LadderEntry, fps, durationMs, chunkIndex?, chunkCount?, traceparent }` |
| thumbnail | `${videoId}--thumbnail--g${generation}` | `{ videoId, sourceKey, generation, durationMs, traceparent }` |
| package | `${videoId}--package--g${generation}` | `{ videoId, generation, ladder, traceparent }` |
| notify | `${videoId}--notify--${event}--${eventSeq}` | `{ videoId, userId, event, payload, traceparent }` |
| dlq | `${originQueue}--${originJobId}--a${attemptsMade}` | `{ originQueue, originJobId, payload, error, attemptsMade, workerId, failedAt }` |

`generation` increments on every admin/owner re-process so a fresh run never collides with the terminal job IDs of the previous one, while accidental duplicate triggers within a generation collapse.

### 9.3 Fan-out / fan-in with Flows

```ts
// apps/worker/src/stages/probe.ts (excerpt)
await flowProducer.add({
  name: 'package',
  queueName: 'package',
  data: PackageJob.parse({ videoId, generation, ladder, traceparent }),
  opts: { jobId: ids.package(videoId, generation), ...stagePolicies.package, ...defaultJobOptions },
  children: [
    ...ladder.map((r) => ({
      name: `transcode-${r.name}`,
      queueName: `transcode-${r.name}`,
      data: TranscodeJob.parse({ videoId, sourceKey, generation, rendition: r, fps, durationMs, traceparent }),
      opts: {
        jobId: ids.transcode(videoId, r.name, generation),
        ...stagePolicies[`transcode-${r.name}`], ...defaultJobOptions,
        failParentOnFailure: true,          // one dead rendition fails the whole video (explicit product decision)
        removeDependencyOnFailure: false,
      },
    })),
    {
      name: 'thumbnail', queueName: 'thumbnail',
      data: ThumbnailJob.parse({ videoId, sourceKey, generation, durationMs, traceparent }),
      opts: { jobId: ids.thumbnail(videoId, generation), ...stagePolicies.thumbnail, ...defaultJobOptions,
              failParentOnFailure: false, ignoreDependencyOnFailure: true },   // a missing sprite must not block READY
    },
  ],
});
```

The parent `package` job sits in `waiting-children` and becomes processable only when every child has completed (or has been ignored per `ignoreDependencyOnFailure`). `package` reads `await job.getChildrenValues()` to collect each rendition's `{ playlistKey, segmentCount, bytes, avgBitrate }` return value — no extra DB round-trip for the fan-in.

### 9.4 Worker process model

```ts
// apps/worker/src/main.ts (shape)
const stage = Env.WORKER_STAGE;                                  // e.g. "transcode-1080p"
const def = stageRegistry[stage];                                // { queue, processor, concurrency, lockDuration }
const worker = new Worker(def.queue, withTelemetry(def.processor), {
  connection, prefix: 'bull',
  concurrency: def.concurrency,
  lockDuration: def.lockDuration,        // e.g. 120_000 for transcodes
  lockRenewTime: def.lockDuration / 2,   // heartbeat cadence (BullMQ default = lockDuration/2)
  stalledInterval: 30_000,
  maxStalledCount: 2,                    // a job may be recovered from a dead worker twice before it is failed
  drainDelay: 5,
  settings: { backoffStrategy: jitteredBackoff },   // only if a custom curve is ever needed; built-in jitter covers MVP
});
worker.on('failed', onFailed(def));      // DLQ pattern (§9.6)
worker.on('stalled', (jobId) => metrics.stalled.inc({ queue: def.queue }));
registerGracefulShutdown(worker, { timeoutMs: def.shutdownTimeoutMs });   // SIGTERM → worker.close() (waits for active job)
```

Concurrency rules:

- **Transcode = 1 job per pod**, `FFMPEG_THREADS` = CPU limit. Parallelism comes from replicas (KEDA), not from in-process concurrency — this keeps memory predictable (x264 1080p ≈ 1–1.5 GB) and lets a pod be a clean unit of scale.
- I/O stages (`probe`, `package`, `notify`) run concurrency 4–8 per pod.
- **Global rate limit** on `notify` (`limiter: { max: 100, duration: 10_000 }`) protects downstream webhooks.
- **Per-user fairness** (Should-have): the API checks `count(videos WHERE owner_id = $1 AND status IN (PROBING, PROCESSING)) < MAX_INFLIGHT_PER_USER` before enqueueing; excess videos stay `UPLOADED` and are released by the reconciler — a poor man's admission controller. Priority: `tier = 'pro' → priority 1`, `free → 5` (lower is higher in BullMQ).

### 9.5 Long-running jobs: heartbeats, crashes, double-processing

**Heartbeat = lock renewal.** A BullMQ worker holds a Redis lock on the active job and renews it every `lockRenewTime`. If the process dies, the lock expires after `lockDuration`; the stalled-checker (any worker, every `stalledInterval`) moves the job back to `wait` and increments `stalledCounter`. After `maxStalledCount` stalls the job fails (→ DLQ). Nothing in our code polls a "heartbeat table" — but we *also* write `processing_steps.heartbeat_at` on every progress tick so operators can see liveness in SQL and so a "stuck-but-locked" job (renewing locks while ffmpeg hangs) is detectable: `heartbeat_at` stale + `status = RUNNING` → alert `WorkerStuck`, and the processor enforces a **hard per-job timeout** (`max(3 × durationMs, 10 min)`) that kills ffmpeg and throws `TransientError('FFMPEG_TIMEOUT')`.

**Progress as a signal.** ffmpeg `-progress pipe:1` emits `out_time_ms` every ~0.5 s; the processor throttles to one `job.updateProgress(pct)` + one `PUBLISH` per 2 s, and one `video_events` row per 10 %.

**Crash scenarios and outcomes**

| Scenario | Detection | Outcome | Empirical Validation (S4–S7, Ticket 29) |
|---|---|---|---|
| Worker pod `kill -9` at 50 % | Lock expires (≤ 120 s) → stalled → re-queued | Another pod restarts the rendition from scratch; identical object keys overwritten; `renditions.status` goes RUNNING → DONE once; `stalledCounter=1`. | **Validated in S4:** 50/50 videos reached `READY`; 8 stalled events caught in mean 128 s (≤ 142 s); 0 orphan segments on S3; `stalledCounter` incremented. |
| Worker network-partitioned but alive (keeps encoding, cannot renew lock) | Stalled → re-queued → **two workers encode the same rendition** | Both write identical bytes to identical keys — harmless. The **fencing token** (`processing_steps.lock_token`) means only the second (current) worker's `DONE` update matches; the zombie's fenced `UPDATE … WHERE lock_token = $old` affects 0 rows, it logs `FENCED_OUT` and exits without emitting events. | **Validated in S4 & Ticket 09:** Zombie workers safely rejected by CAS fencing token with `FENCED_OUT` in logs; exactly 1 `video.ready` event recorded per video. |
| ffmpeg hangs (no progress) | Job timeout → `TransientError` | Retry with backoff; DLQ after 4. | Hard timeout `max(3 × durationMs, 10 min)` kills ffmpeg process tree; job re-enqueued with backoff. |
| OOM-killed ffmpeg (exit 137) | Non-zero exit → `TransientError('FFMPEG_OOM')` | Retry; the processor lowers `-threads` by one on each attempt as a mitigation; DLQ after 4 with the hint `INCREASE_MEMORY`. | Lowering `-threads` mitigates peak RSS; DLQ capture preserves diagnostic context. |
| Redis restart | Workers reconnect (ioredis retry strategy); in-flight jobs continue and complete on reconnect (BullMQ moves them via `moveToCompleted` when the connection returns); jobs whose locks expired are re-queued | AOF `everysec` bounds loss to ≤ 1 s of *queue state*; DB reconciler re-adds anything lost. | **Validated in S5:** ioredis reconnected in 1.4 s; AOF prevented job loss; all 30 in-flight videos completed to `READY`. |
| Storage 503 for 60 s | AWS SDK retries (3, adaptive) then `TransientError('STORAGE_UNAVAILABLE')` | Backoff 10/20/40 s covers the window. | **Validated in S5:** Jitter factor (`0.5`) spread reconnect attempts across 15–35 s; all 30 videos reached `READY` with zero operator intervention. |
| Storage down > 10 min (Systemic failure) | 4 attempts exhausted → DLQ | `SystemicFailure` alert fires; runbook pauses queue; recovery + replay succeeds. | **Validated in S5:** `dlq_entries` populated; `SystemicFailure` alert fired; `POST /admin/dlq/:id/replay` re-enqueued jobs with `--r1` to `READY`. |
| API node crash with 5 000 SSE clients | Socket disconnect / EOF | Clients reconnect with `Last-Event-ID`; API responds with snapshot and replays backlog from `video_events`. | **Validated in S6:** 5 000 VUs reconnected cleanly; 0 missed terminal events; publish-to-receive p95 = 412 ms; RSS remained < 320 MB. |
| Worker temporary storage full (`ENOSPC`) | File write error / disk threshold | Throws `TransientError('DISK_FULL')`; triggers cleanup; `WorkerTmpDiskHigh` alert fires if usage > 80%. | **Validated via `disk-fill.sh`:** Alert fires on Prometheus threshold; cleaner sweeps orphaned partials. |
| Postgres unavailable | `TransientError` from `packages/server/db` | Backoff; readiness probe fails → KEDA/HPA hold. | Database client retry strategy catches transient disconnects. |

**Preventing double *effects* rather than double *execution*.** Under at-least-once delivery we do not try to prevent two executions — that would require a distributed lock stronger than the queue's own. We make executions idempotent (deterministic keys; overwrite-safe) and make the *commit* exclusive (fencing token + CAS). This is the standard "effectively-once" pattern and is cheaper and more robust than exactly-once machinery.

### 9.6 Failure handling, retries, DLQ, poison pills

```mermaid
flowchart TD
    A["processor throws"] --> B{"error type"}
    B -- "UnrecoverableError" --> D["BullMQ: no retry → failed"]
    B -- "TransientError / unknown" --> C{"attemptsMade < attempts?"}
    C -- "yes" --> R["delayed → wait<br/>exp backoff + jitter"]
    C -- "no" --> D
    D --> E["worker.on('failed')"]
    E --> F["INSERT dlq_entries<br/>UPDATE processing_steps DEAD<br/>UPDATE renditions FAILED"]
    F --> G["dlqQueue.add(copy of job + error)"]
    G --> H{"child with failParentOnFailure?"}
    H -- "yes" --> I["parent package fails → video FAILED<br/>notify(video.failed)"]
    H -- "no" --> J["ignored dependency<br/>package proceeds without it"]
    I --> K["metrics dlq_total++<br/>alert DLQNotEmpty"]
    K --> L["Admin: inspect → replay (new generation or --r{n}) or discard"]
```

Rules:

1. **Classification at the throw site** (ADR-18). `probe` is the main poison-pill filter: it runs first, is cheap, and throws `UnrecoverableError` for anything ffmpeg cannot fix by retrying. A corrupt file therefore costs one ffprobe run, not four 1080p attempts.
2. **No native DLQ in BullMQ** → the `failed` listener implements it: park a copy in the `dlq` queue (no consumer) and mirror to Postgres. `removeOnFail` keeps the original visible in Bull Board for a week.
3. **Replay** re-adds to the origin queue with `jobId = original + '--r' + n` (fresh attempt counter) and writes `video_events(dlq.replayed)`; **discard** marks the entry `DISCARDED`. Both are admin-only and audited.
4. **Backoff with jitter** avoids thundering herds when storage comes back (`jitter: 0.5` spreads 40 s → 20–40 s).
5. **Circuit for systemic failures:** if `jobs_failed_total` for a queue exceeds 50 % over 5 min, the alert `SystemicFailure` fires and the runbook says *pause the queue* (`queue.pause()`, available in Bull Board) rather than burning attempts against a dead dependency.
6. **Retries are bounded per attempt too**: `attempt n` uses `FFMPEG_THREADS - (n-1)` (min 1) to survive marginal memory situations.

### 9.7 Idempotency guarantees per step

| Step | Idempotency mechanism | Duplicate-run behaviour |
|---|---|---|
| Upload complete | `uploads.status` CAS `OPEN → COMPLETED`; `CompleteMultipartUpload` is idempotent on the storage side (same parts → same object); `HeadObject` re-verifies | Second call returns 202 with current status; no second probe job (same `jobId`). |
| probe | Job ID; `processing_steps` upsert; `videos` CAS `UPLOADED→PROBING` (0 rows → check status: already `PROCESSING`/`READY` → return early "already done") | Flow add with same child IDs is a no-op if the flow exists. |
| transcode | Deterministic keys; playlist uploaded **last** (its presence = rendition complete); fenced `DONE` | Re-encode overwrites bytes; only current token commits. |
| thumbnail | Deterministic keys; fenced commit | Same. |
| package | Verifies children via `getChildrenValues()` + `HEAD` each playlist; writes `master.m3u8` last; `videos` CAS `PROCESSING→READY` | Second run re-writes an identical master; CAS returns 0 rows → no duplicate `video.ready` event. |
| notify | `jobId` includes `eventSeq`; SSE publish is loss-tolerant; webhook carries `Idempotency-Key = jobId` | Receiver deduplicates on the key. |
| housekeeping | `SKIP LOCKED` batches; every action is a CAS | Overlapping schedulers cannot double-abort. |

### 9.8 Housekeeping (Job Schedulers)

BullMQ 6 Job Schedulers (`queue.upsertJobScheduler(id, { pattern }, template)`) replace legacy repeatables — the API upserts them on boot, so restarting the API is safe.

| Scheduler ID | Cron | Action |
|---|---|---|
| `reconcile-uploads` | `*/15 * * * *` | Abort `UPLOADING > 24h` (→ `ABANDONED`); re-enqueue `UPLOADED` with no probe step > 5 min; release admission-held videos. |
| `reconcile-processing` | `*/10 * * * *` | Videos `PROCESSING > 3h` with no RUNNING step and no waiting job → mark `FAILED('ORPHANED')` + DLQ entry (belt-and-braces for lost Redis state). |
| `purge-deleted` | `0 * * * *` | Delete objects for `DELETED` videos older than 1 h (paginated `DeleteObjects`), then hard-delete rows. |
| `expire-raw` | `30 3 * * *` | Delete `raw/` sources of `READY` videos older than `RAW_RETENTION_DAYS` (lifecycle rule is the primary mechanism; this is the audit trail). |
| `tmp-sweep` | `*/30 * * * *` | Remove orphaned `/tmp/vp/*` dirs older than 2 h on the housekeeping pod (worker pods clean their own on exit). |
| `reconcile-reaction-counters` | `0 * * * *` | Detect and repair drift between exact `video_reactions` counts and cached counter columns (`videos.likes_count`, `videos.dislikes_count`). |

---

## 10. Real-Time Status (SSE)

### 10.1 Wire format

```
GET /v1/videos/{id}/events
Accept: text/event-stream
Last-Event-ID: 1842            (optional, on reconnect)

HTTP/1.1 200
Content-Type: text/event-stream
Cache-Control: no-cache
X-Accel-Buffering: no

id: 1839
event: snapshot
data: {"videoId":"…","status":"PROCESSING","progress":{"overall":41,"byRendition":{"1080p":22,"720p":55,"480p":100}}}

id: 1840
event: progress
data: {"rendition":"720p","percent":57,"overall":42}

: ping

id: 1841
event: status
data: {"status":"READY","playbackUrl":"https://cdn…/master.m3u8"}
```

`id` is the `video_events.id` (bigserial) so `Last-Event-ID` maps to "replay rows with id > X" — reconnecting clients receive exactly the transitions they missed, then go live. Progress events are *not* persisted per tick (only every 10 %), so a reconnect may skip intermediate percentages; the snapshot fixes the current value immediately.

### 10.2 Fan-out architecture

```mermaid
flowchart LR
    W[worker] -- "PUBLISH video:{id} · user:{uid}" --> R[(Redis Pub/Sub)]
    R -- "PSUBSCRIBE video:* user:*" --> A1[api pod 1<br/>SseHub]
    R --> A2[api pod 2<br/>SseHub]
    A1 --> C1[client]
    A1 --> C2[client]
    A2 --> C3[client]
```

- One dedicated ioredis connection per API pod in subscriber mode; `SseHub` keeps `Map<channel, Set<Reply>>`. O(1) publish, O(subscribers-of-channel) fan-out.
- **Snapshot-on-connect**: authorise → `SELECT` video → write `snapshot` → subscribe → replay `video_events WHERE id > lastEventId` (if header present). Ordering: subscribe *before* the DB read to avoid a gap; deduplicate by `id`.
- **Backpressure**: if `reply.raw.write()` returns `false`, coalesce `progress` events (keep latest) until `drain`; never coalesce `status`/`error` events.
- **Limits**: 20 SSE connections per user; 5 000 per pod (`@fastify/under-pressure` sheds beyond); heartbeat `: ping` every 15 s; server closes idle streams after 30 min (client auto-reconnects).
- **Ordering & loss**: Pub/Sub is fire-and-forget; that is acceptable because the DB is the truth and the snapshot/replay path re-synchronises. Terminal states are additionally persisted in `notify` (`video_events`) before publishing.
- Also exposed: `GET /v1/me/events` on channel `user:{userId}` for list pages.

---

## 11. Security

| Area | Control |
|---|---|
| Authentication | A bearer token is verified by the `TokenVerifier` port (`@vp/core/ports`), and `AUTH_MODE` picks the adapter once, in `toAppConfig`. `jwks` verifies against `AUTH_JWKS_URL`: `iss` must equal `AUTH_ISSUER`, `aud` must name `AUTH_AUDIENCE`, `exp` is required, `alg` must be one of `AUTH_ALGORITHMS` and the one the JWK declares (never `none`), a kid-less token is refused while the key set holds more than one key, ES* signatures are read as JWS `r||s`, and an unknown `kid` refetches the key set at most once per 30 s so a rotated key is accepted at once. `dev` verifies `pnpm dev-token` tokens against the key derived from the committed seed and serves that key at `/.well-known/jwks.json`; production refuses `AUTH_MODE=dev` at `loadEnv()`, so neither the route nor the seed key exist there (`auth-hardening.test.ts`). `sub` becomes `users.id`, provisioned on first sight. An admin is a token whose verified role claim is `admin`; the static `x-admin-token` (constant-time compare) exists in dev mode only, acts as the provisioned `AUTH_DEV_USER_ID`, and production refuses any `ADMIN_TOKEN`. |
| Authorisation | CASL rules in `@vp/permissions` (`packages/universal/permissions`), shared by `apps/api` and `apps/web`. `Role` is `'GUEST' \| 'USER' \| 'CREATOR' \| 'MODERATOR' \| 'ADMIN'`; `parseRole` turns an untrusted claim into one at the boundary (anything unknown is `GUEST`), and `getUserPermissions(user)` builds the ability from the per-subject rule sets. The API decides access in its domain services only, through the `AuthorizationPort` (`@vp/core/ports`, implemented by `CaslAuthorizationAdapter`) with a `canX({ user, ... })` helper or `assertCan(...)`; routes read `request.user` or `requireAuth(request)` and never check a role. List queries apply the same rules in SQL: `packages/server/adapters/postgres/scopes/` compiles them with CASL `rulesToAST` (`rules-to-sql`, `where`, `accessible-by`, `soft-delete`). A failure is an RFC 9457 problem (401 `UNAUTHORIZED`, 403 `FORBIDDEN`) through `sendResult`. In `apps/web`, `PermissionsProvider`, `useCan` and `<Can />` gate the UI from the same rules. A video is readable when it is `public` or `unlisted`, by its owner, or by a `MODERATOR`; only its owner may update or delete it. |
| Upload safety | Presigned URLs live `S3_PRESIGN_TTL_SEC` (900 s); `Content-Type` and `Content-Length` are signed into the single-PUT URL. On complete, both strategies `HeadObject` the source and compare its size to the declared one; on a mismatch the server deletes the object and moves the video to `REJECTED`. Content-type allowlist `ALLOWED_CONTENT_TYPES` in `@vp/validation` (`video/mp4`, `video/webm`, `video/quicktime`, `video/x-matroska`). Per-user limits `MAX_UPLOAD_BYTES` and `MAX_INFLIGHT_PER_USER`. |
| Storage | Buckets private; the CDN reads `public` through the R2 custom domain (`infra/terraform/main.tf`). Terraform issues two scoped R2 tokens: the API's reads and writes `raw` only; the worker's reads `raw` and reads and writes `public`. Housekeeping (`expire-raw`, `purge-deleted`) deletes from `raw` with the worker's token, which that scope does not grant. |
| Command injection | FFmpeg and ffprobe run through `spawn` with argv arrays (`@vp/ffmpeg`), never a shell. Object keys come from `@vp/storage` `keys.ts` and are built from the video UUID; the only part taken from the uploaded filename is the extension of `raw/<videoId>/source.<ext>`, and the filename is otherwise only the default title. |
| Webhooks | Not built: no feature sends one, so `WEBHOOK_SIGNING_SECRET` and `WEBHOOK_URL_ALLOWLIST` are not declared. When outbound webhooks land they sign with HMAC-SHA256 (`X-Signature: t=…,v1=…`, 5-min replay window), go only to `https://` URLs behind an SSRF guard, and bring their keys back. |
| Rate limiting | `@fastify/rate-limit`, registered with `global: false`, limits two routes, keyed by user (fallback IP): `POST /v1/uploads` at `UPLOAD_RATE_LIMIT_MAX` per minute (30) and reprocess at 5 per minute, with admins on the reprocess `allowList`. Reads are not rate-limited. The client IP is read through `X-Forwarded-For` only from the proxies `TRUST_PROXY` names, and a JSON body over `HTTP_BODY_LIMIT_BYTES` answers 413. |
| Transport | TLS terminated by Cloudflare (`cloudflared` tunnel) in cloud; `@fastify/helmet` sets its default headers, HSTS included, with CSP off; CORS allows exactly the `CORS_ORIGINS` list, and production refuses an empty list or `*`. |
| Secrets | Env only; `.env` git-ignored; no secrets in images. The cloud overlay holds no credential at all: an `ExternalSecret` (External Secrets Operator, `ClusterSecretStore` `vp-secret-store`) materialises `vp-secrets`, and the overlay deletes the base's local Secret. **No secret-shaped key has a default.** `SECRET_KEYS` (`DATABASE_URL`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `REDIS_PASSWORD`) are required under `NODE_ENV=production`, and every secret and every `*_URL` key is refused there if it holds a credential this repo ships for local use (`vp`, `minioadmin`, `admin`, `change-me*`, bare or as URL userinfo). No schema default and no production literal carries URL userinfo. `production-secrets.test.ts` renders the base and the cloud overlay with kustomize and holds both; `no-defaulted-secrets.test.ts` holds the schema. |
| Containers | Non-root user (uid 10001), `runAsNonRoot` and `readOnlyRootFilesystem` in the k8s base, `/tmp/vp` on an `emptyDir` (8 Gi for transcode) or compose `tmpfs`, `resources.limits` on every pod. The API runs on `node:24-slim`; the worker on `oven/bun:1.4-slim` (default) or `node:24-slim`, with Debian's `ffmpeg` package. Both images remove npm and corepack and start under `tini`. |
| Redis | `requirepass` everywhere; a cluster-internal Service in k8s (compose publishes 6379 to the host for local tools); `noeviction`, set in compose and the k3d chart and Redis's own default in the cloud overlay. |
| Supply chain | Renovate (`renovate.json`); `pnpm install --frozen-lockfile` in CI; images built in CI and scanned with Trivy (`images.yml`); MinIO images pinned by digest (`minio-images-pinned.test.ts`). The app images are referenced by tag (`latest`), not digest, in the k8s manifests. |
| Privacy | No PII beyond email. `@vp/logger` redacts the `authorization`, `cookie` and `x-admin-token` headers wherever a headers object is logged, and the access log records the route template, never the URL. |

---

## 12. Deployment Topologies & Cost Model

Three rungs, same images, same env contract. Moving up a rung changes manifests, never code.

### 12.1 Rung 1 — Docker Compose (local dev, Phase 0–2)

```yaml
# infra/compose/docker-compose.yml (outline — full file in repo)
name: video-pipeline
services:
  postgres:
    image: postgres:16-alpine
    environment: { POSTGRES_USER: vp, POSTGRES_PASSWORD: vp, POSTGRES_DB: vp }
    ports: ["5432:5432"]
    volumes: [pgdata:/var/lib/postgresql/data]
    healthcheck: { test: ["CMD-SHELL", "pg_isready -U vp"], interval: 5s }

  redis:
    image: redis:7-alpine
    command: ["redis-server", "--appendonly", "yes", "--appendfsync", "everysec",
              "--maxmemory", "256mb", "--maxmemory-policy", "noeviction", "--requirepass", "vp"]
    ports: ["6379:6379"]
    volumes: [redisdata:/data]

  minio:
    image: cgr.dev/chainguard/minio@sha256:<index digest>
    command: ["server", "/data", "--console-address", ":9001"]   # the binary is the entrypoint, no shell
    environment: { MINIO_ROOT_USER: minioadmin, MINIO_ROOT_PASSWORD: minioadmin }
    ports: ["9000:9000", "9001:9001"]
    volumes: [miniodata:/data]

  minio-init:                      # creates buckets, lifecycle rules, anonymous read on `public`, optional webhook
    image: cgr.dev/chainguard/minio-client@sha256:<latest-dev index digest>   # -dev carries the shell the script needs
    depends_on: [minio]            # the script retries `mc alias set` until MinIO answers
    entrypoint: ["/bin/sh", "/init/minio-init.sh"]
    volumes: ["./minio-init.sh:/init/minio-init.sh:ro"]

  api:
    build: { context: ../.., dockerfile: apps/api/Dockerfile }
    env_file: [../../.env]
    ports: ["3000:3000", "9464:9464"]          # http, metrics
    depends_on: [postgres, redis, minio-init]
    command: ["node", "dist/main.js"]

  migrate:
    build: { context: ../.., dockerfile: apps/api/Dockerfile }
    env_file: [../../.env]
    command: ["node", "dist/migrate.js"]
    depends_on: { postgres: { condition: service_healthy } }
    restart: "no"

  # ---- workers: one image, WORKER_STAGE picks the role -----------------------
  worker-probe:          &worker
    build: { context: ../.., dockerfile: apps/worker/Dockerfile }
    env_file: [../../.env]
    environment: { WORKER_STAGE: probe }
    depends_on: [redis, postgres, minio-init]
    tmpfs: ["/tmp/vp:size=2g"]
    deploy: { resources: { limits: { cpus: "1", memory: 1g } } }
  worker-transcode-1080p:
    <<: *worker
    environment: { WORKER_STAGE: transcode-1080p, FFMPEG_THREADS: "2" }
    deploy: { resources: { limits: { cpus: "2", memory: 2g } } }
  worker-transcode-720p:
    <<: *worker
    environment: { WORKER_STAGE: transcode-720p, FFMPEG_THREADS: "2" }
    deploy: { resources: { limits: { cpus: "2", memory: 1500m } } }
  worker-transcode-480p:
    <<: *worker
    environment: { WORKER_STAGE: transcode-480p, FFMPEG_THREADS: "1" }
  worker-thumbnail:      { <<: *worker, environment: { WORKER_STAGE: thumbnail } }
  worker-package:        { <<: *worker, environment: { WORKER_STAGE: package } }
  worker-notify:         { <<: *worker, environment: { WORKER_STAGE: notify } }
  worker-housekeeping:   { <<: *worker, environment: { WORKER_STAGE: housekeeping } }

  # ---- observability (profile: observability) ---------------------------------
  prometheus:   { image: prom/prometheus:latest, profiles: [observability], ports: ["9090:9090"], volumes: ["./prometheus.yml:/etc/prometheus/prometheus.yml:ro"] }
  grafana:      { image: grafana/grafana:latest, profiles: [observability], ports: ["3001:3000"], volumes: ["./grafana/provisioning:/etc/grafana/provisioning:ro", "../../observability/dashboards:/var/lib/grafana/dashboards:ro"] }
  tempo:        { image: grafana/tempo:latest, profiles: [observability], command: ["-config.file=/etc/tempo.yml"], volumes: ["./tempo.yml:/etc/tempo.yml:ro"] }
  loki:         { image: grafana/loki:latest,  profiles: [observability] }
  otel-collector: { image: otel/opentelemetry-collector-contrib:latest, profiles: [observability], volumes: ["./otel-collector.yml:/etc/otelcol-contrib/config.yaml:ro"], ports: ["4318:4318"] }
  hls-test-page: { image: nginx:alpine, profiles: [tools], ports: ["8080:80"], volumes: ["../../tools/hls-test-page:/usr/share/nginx/html:ro"] }

volumes: { pgdata: {}, redisdata: {}, miniodata: {} }
```

Developer loop: `pnpm dev` runs API + all workers with hot reload against the compose infrastructure (`docker compose up postgres redis minio minio-init`); `docker compose --profile observability up` adds the monitoring stack; `pnpm compose-autoscaler` is the Phase-3-lite scaler (§13.2).

**Offline mode (local-first, PRD G11/FR-19).** After a one-time `pnpm install` and image pull, the whole stack — upload, probe, transcode, package, SSE, playback, Bull Board, `/docs`, and the observability profile — runs with the network unplugged. Guarantees: every runtime dependency has a compose container (including the dev JWKS issuer from `packages/server/dev-token`); `.env.example` defaults are all-local and work unedited; browser libraries in `tools/hls-test-page` are vendored (no CDN references); the OTel exporter is a no-op when `OTEL_EXPORTER_OTLP_ENDPOINT` is empty; library telemetry is disabled (`TURBO_TELEMETRY_DISABLED=1`, `DO_NOT_TRACK=1`); images contain everything they need at start (no `apt`/`npm` at runtime). `make smoke-offline` runs the smoke test on a compose network with `internal: true` (no egress) and is a CI gate. The external providers in §15.3 exist only for Rung 3.

**Worker Dockerfile (runtime-switchable, multi-arch):**

```dockerfile
# apps/worker/Dockerfile
ARG WORKER_RUNTIME=bun                     # bun | node
FROM node:24-slim AS build
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /repo
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./
COPY apps/worker/package.json apps/worker/
COPY packages/*/package.json packages/
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm turbo run build --filter=@vp/worker... && pnpm deploy --filter=@vp/worker --prod /out

FROM oven/bun:1.4-slim AS runtime-bun
FROM node:24-slim      AS runtime-node
FROM runtime-${WORKER_RUNTIME} AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg ca-certificates tini \
 && rm -rf /var/lib/apt/lists/* && useradd -r -u 10001 worker
COPY --from=build /out /app
WORKDIR /app
USER worker
ENV NODE_ENV=production TMPDIR=/tmp/vp
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["sh", "-c", "exec ${WORKER_RUNTIME:-bun} dist/main.js"]
```

(`tini` forwards `SIGTERM` and reaps zombie ffmpeg processes; `sh -c exec` keeps PID 1 clean. Built with `docker buildx build --platform linux/amd64,linux/arm64`.)

### 12.2 Rung 2 — Kubernetes locally (kind or k3d, Phase 3)

`infra/k8s/` is a Kustomize tree (`base/` + `overlays/{local,cloud}`) — Helm only for third-party charts (KEDA, kube-prometheus-stack, MinIO, Redis). Local cluster: `k3d cluster create vp --agents 2 -p "3000:80@loadbalancer"` (k3d is faster than kind and ships Traefik; either works — the Makefile supports both).

Base manifests: `api` Deployment (2 replicas, HPA on CPU 70 %), one Deployment per worker stage, `ScaledObject` per worker Deployment, `Secret`/`ConfigMap` from the same `.env` contract, `ServiceMonitor`s, `PrometheusRule`s, Grafana dashboards as ConfigMaps.

Transcode Deployment essentials:

```yaml
spec:
  replicas: 0                                   # KEDA owns this
  template:
    spec:
      terminationGracePeriodSeconds: 900        # let a 1080p job finish on scale-in
      containers:
        - name: worker
          image: ghcr.io/szebest/vp-worker@sha256:…
          env:
            - { name: WORKER_STAGE, value: transcode-1080p }
            - { name: FFMPEG_THREADS, valueFrom: { resourceFieldRef: { resource: limits.cpu } } }
          resources:
            requests: { cpu: "1500m", memory: "1.5Gi", ephemeral-storage: "6Gi" }
            limits:   { cpu: "2",     memory: "2Gi",   ephemeral-storage: "8Gi" }
          volumeMounts: [{ name: tmp, mountPath: /tmp/vp }]
          securityContext: { runAsNonRoot: true, readOnlyRootFilesystem: true, allowPrivilegeEscalation: false }
          livenessProbe:  { exec: { command: ["sh", "-c", "test $(( $(date +%s) - $(cat /tmp/vp/heartbeat) )) -lt 120"] }, periodSeconds: 30 }
      volumes: [{ name: tmp, emptyDir: { sizeLimit: 8Gi } }]
```

### 12.3 Rung 3 — Cloud reference deployment (Phase 4)

```mermaid
flowchart LR
    U[Users / frontend] --> CF[Cloudflare<br/>DNS · CDN · Tunnel · WAF]
    CF -- "api.example.com (Tunnel)" --> K3S
    CF -- "cdn.example.com (R2 custom domain)" --> R2[(Cloudflare R2<br/>raw · public)]
    subgraph VPS["Hetzner CAX11 (arm64, 2 vCPU / 4 GB) or Oracle A1 (2 OCPU / 12 GB) — k3s"]
        K3S[Traefik ingress] --> API[api ×1]
        KEDA[KEDA] --> W[worker deployments<br/>0..N per stage]
        REDIS[(Redis, 256 MB, AOF, PVC)]
        ALLOY[Grafana Alloy<br/>metrics · logs · traces]
    end
    API & W --> NEON[(Neon Postgres free)]
    API & W --> R2
    API & W --> REDIS
    ALLOY --> GC[Grafana Cloud free<br/>Prometheus · Loki · Tempo]
    GH[GitHub Actions] -- "buildx multi-arch → GHCR" --> K3S
```

Capacity reality check on a 2-vCPU node: the API (~150 MB), Redis (~50 MB), KEDA + k3s (~600 MB) leave ~2.5 GB / 1.5 vCPU for **one** 1080p transcode at a time (or two 480p). That is fine for a portfolio deployment; the load tests that need real parallelism run locally on the laptop (8 vCPU) or on a temporary Hetzner CCX instance for an hour (≈ €0.10). KEDA `maxReplicaCount` in the cloud overlay is therefore 1 for 1080p/720p and 2 for 480p/probe — scale-to-zero is what saves money, not scale-out.

**Monthly cost model (verified 2026-09-03):**

| Item | Oracle path | Hetzner path |
|---|---|---|
| Compute | €0 (A1 2 OCPU/12 GB Always Free) | €5.99 CAX11 (or €5.49 CX23) + €0.50 IPv4 |
| Object storage | R2 free: 10 GB, 1 M Class A, 10 M Class B, **€0 egress** | same |
| Postgres | Neon free (0.5 GB, 100 CU-h) | same |
| Redis | self-hosted on node | same |
| Observability | Grafana Cloud free (10k series, 50 GB logs/traces, 14 d) | same |
| CDN / DNS / Tunnel | Cloudflare free | same |
| CI / registry | GitHub Actions + GHCR free (public repo) | same |
| **Total** | **€0** | **≈ €6.5** |

Guardrails: R2 Class A ops are the metric to watch (every segment upload is one PUT: a 10-min video ≈ 100 segments × 3 renditions ≈ 300 Class A ops → 1 M free ops ≈ 3 300 videos/month); Neon compute hours are burned by the reconciler's cron — keep its frequency at 15 min so autosuspend (5 min idle) still kicks in between runs; set `RAW_RETENTION_DAYS=7` to stay under 10 GB.

**Provider fallback ladder** (all env-only switches): R2 → B2 (+Cloudflare CDN via Bandwidth Alliance) → MinIO on the VPS PVC. Neon → Supabase (note 1-week pause) → Postgres on the VPS. Hetzner → Oracle → any €5 VPS.

---

## 13. Autoscaling & Observability

### 13.1 Metrics catalogue

Exposed by `packages/server/observability` (`prom-client` registry; API on `:9464/metrics`, workers likewise; scraped by Prometheus/Alloy).

| Metric | Type | Labels | Source | Used for |
|---|---|---|---|---|
| `http_request_duration_seconds` | histogram | `method, route, status` | API | RED, SLO p95 < 200 ms |
| `http_requests_in_flight` | gauge | — | API | load shedding |
| `sse_connections` | gauge | `channel_type` | API | fan-out capacity |
| `sse_events_published_total` | counter | `event` | workers | |
| `bullmq_queue_jobs` | gauge | `queue, state ∈ {waiting, prioritized, active, delayed, failed, completed, waiting-children}` | API (`queue-metrics` poller every 5 s via `queue.getJobCounts()`) | **KEDA scaling**, dashboards |
| `bullmq_queue_oldest_waiting_age_seconds` | gauge | `queue` | API poller | starvation alert |
| `jobs_processed_total` | counter | `queue, result ∈ {completed, failed, dlq, stalled}` | workers | failure rate |
| `job_duration_seconds` | histogram | `queue` | workers | p95 job latency |
| `job_wait_seconds` | histogram | `queue` | workers (`processedOn - timestamp`) | queue lag |
| `transcode_realtime_factor` | histogram | `rendition, preset` | transcode | video-seconds per wall-second (>1 = faster than realtime) |
| `transcode_output_bytes_total` | counter | `rendition` | transcode | storage growth |
| `ffmpeg_exit_total` | counter | `stage, code` | workers | OOM (137) detection |
| `storage_ops_total` / `storage_op_duration_seconds` | counter / histogram | `op ∈ {put,get,head,multipart}, bucket, result` | all | R2 Class A budget, latency |
| `worker_tmp_bytes` | gauge | `stage` | workers | disk pressure |
| `dlq_entries_total` | counter | `queue, error_code` | failed handler | alerting |
| `videos_by_status` | gauge | `status` | API poller (SQL) | business view |
| `processing_steps_running_stale` | gauge | — | API poller (SQL) | stuck worker alert |
| `time_to_ready_seconds` | histogram | `bucket ∈ {<1min,1-5,5-15,15-60}` (source duration) | package | product SLO |
| `reconciler_repairs_total` | counter | `type` | reconciler | stuck/lost jobs repaired (stays 0 under outbox) |
| `outbox_drain_duration_seconds` | histogram | — | housekeeping | outbox batch drain latency |
| `outbox_events_published_total` | counter | `kind` | housekeeping | outbox events published to BullMQ |

### 13.2 KEDA ScaledObject (Prometheus scaler, primary)

```yaml
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata: { name: vp-worker-transcode-1080p-scaledobject, namespace: video-pipeline }
spec:
  scaleTargetRef: { apiVersion: apps/v1, kind: Deployment, name: vp-worker-transcode-1080p }
  minReplicaCount: 0
  maxReplicaCount: 6                 # the cloud overlay patches it to 1
  pollingInterval: 10
  cooldownPeriod: 300                # wait 5 min of empty queue before scaling to zero
  advanced:
    horizontalPodAutoscalerConfig:
      behavior:
        scaleUp:   { stabilizationWindowSeconds: 0,   policies: [{ type: Pods, value: 4, periodSeconds: 30 }, { type: Percent, value: 100, periodSeconds: 30 }] }
        scaleDown: { stabilizationWindowSeconds: 300, policies: [{ type: Pods, value: 1, periodSeconds: 60 }, { type: Percent, value: 10, periodSeconds: 60 }] }
  triggers:
    - type: prometheus
      metadata:
        serverAddress: http://kube-prometheus-stack-prometheus.monitoring.svc:9090
        query: |
          sum(max by (state) (bullmq_queue_jobs{queue="transcode-1080p", state=~"waiting|prioritized|active"})) or vector(0)
        threshold: "1"               # one pod per outstanding job (concurrency = 1)
        activationThreshold: "0"     # any job wakes the deployment from zero
```

Fallback trigger (no Prometheus dependency), on `vp-worker-transcode-480p` only. It reads the `wait` list, which a job with a priority never enters, so it can only wake the deployment for a job enqueued without one:

```yaml
    - type: redis
      metadata:
        addressFromEnv: REDIS_ADDR          # host:port
        passwordFromEnv: REDIS_PASSWORD
        listName: "bull:transcode-480p:wait"
        listLength: "1"
        activationListLength: "0"
        databaseIndex: "0"
```

Every API replica polls every queue and exports the same depth, so the query takes the `max` per state before it sums; a plain `sum` counts each job once per replica, and two replicas started two pods for one job. Why `waiting + prioritized + active` and threshold 1: every pipeline job carries a priority, and BullMQ keeps a job with one in `prioritized`, not `waiting`, so the API poller reads all three (`QUEUE_JOB_STATES` in `@vp/core/ports`). Workers never write `bullmq_queue_jobs`: a worker has no view of its queue's depth, and a gauge it set would outlive the job and hold the deployment above zero. And threshold 1: with concurrency 1 per pod, `desired = ceil(outstanding / 1)` means every queued job gets a pod and no busy pod is counted as free capacity. KEDA scales the Deployment; the HPA behaviour block prevents flapping and the long `terminationGracePeriodSeconds` plus `worker.close()` makes scale-in safe. Because the queue is *pulled*, over-provisioning during a burst is harmless — surplus pods idle and are removed after cooldown.

**Compose-level scaler (Phase 3-lite, no Kubernetes):** `packages/server/compose-autoscaler` polls `bullmq_queue_jobs` from the API's `/metrics` every 10 s and runs `docker compose up -d --scale worker-transcode-1080p=N --no-recreate` with the same `min/max/cooldown` semantics — a 120-line TypeScript script that demonstrates the control loop on a laptop.

### 13.3 Tracing (OpenTelemetry)

- `initTracing` in `@vp/observability` starts `@opentelemetry/sdk-node` with the OTLP/HTTP trace exporter (`OTEL_EXPORTER_OTLP_ENDPOINT`) and the Node auto-instrumentations, `fs`, `dns` and `net` off; it is off under `NODE_ENV=test`. It is **preloaded**: each app's `src/instrument.ts` is the first module the process loads (`node --import ./dist/instrument.js dist/main.js`, the same flag under Bun), because the instrumentations patch only what is imported after them. The ESM hook wraps third-party modules only; this repo's own modules are excluded, since the hook cannot resolve their extensionless `export *`. The SDK exports traces only - metrics stay with Prometheus, logs with pino.
- The API's HTTP server span is its own Fastify hook, `plugins/request-span.ts`: named `{method} {route template}`, parented on the caller's `traceparent`, and started from the root context, because the HTTP instrumentation hands a request it ignores over with tracing suppressed. The handler runs inside it, so `ioredis` spans and the `traceparent` a handler writes into a job both belong to the request's trace. `postgres` (postgres.js) has no OpenTelemetry instrumentation, so SQL is not a span.
- BullMQ is instrumented by hand: producers inject `traceparent` into `job.data` (`packages/server/job-contracts` makes it a required field); the worker wrapper `withTelemetry(processor)` extracts it and starts a span `bullmq.process {queue}` as a **child of the producer's span**, with `job.id`, `attemptsMade`, `videoId` attributes. Work nothing traced asked for, such as a reconciler repair, starts a root span of its own (`rootTraceparent`). Each `ffmpeg` run is a child span `ffmpeg` carrying `ffmpeg.stage`, the argv with URLs redacted (`ffmpeg.command`) and `ffmpeg.exit_code`.
- Result: one trace = `POST /v1/uploads/:uploadId/complete` -> `probe` -> three `transcode-*` -> `thumbnail` -> `package` -> `notify`, viewable in Tempo (compose `observability` profile, through the otel-collector); the video repository writes the active `trace_id` into `video_events`, so an operator can go from a video row to its trace.
- Sampling: `OTEL_TRACES_SAMPLER` understands `always_on`, `always_off` and `ratio` (with `OTEL_TRACES_SAMPLER_ARG`); any other value, the default `parentbased_always_on` and `parentbased_traceidratio` included, is parent-based always-on. No overlay sets it, so every environment samples 100 %.

### 13.4 Logging

One `createLogger` in `@vp/logger` (`packages/server/logger`, pino) with two formats. `json`, for the deployables, writes to stdout with an ISO timestamp, the `service` name, and the active span's `traceId`/`spanId` on every line, and redacts `authorization`, `cookie` and `x-admin-token` wherever a headers object is logged. `pretty`, for the CLIs, writes one `level message key=value` line to stderr through a destination of our own. The API hands the `json` logger to Fastify with Fastify's request logging off: the request id is the caller's `x-request-id` when it is a plain token, otherwise a UUID, and is echoed back on the response; `plugins/access-log.ts` writes one `request completed` line per request with `method`, `route` (the template, `unmatched` on a 404), `status` and `durationMs`, and an unhandled error writes one `unhandled exception` line, both carrying `reqId`. The id travels into job payloads as `requestId` beside `traceparent`, and a worker's `LogContext` puts it on every line of that job; stage loggers also bind `videoId`, `jobId` and `attempt`. Nothing in this repo ships the lines anywhere: the SDK exports traces only, so the collector's and Alloy's OTLP log pipelines receive nothing from the apps, and Loki sees only what a log agent outside this repo collects from stdout. `ffmpeg` stderr is not logged: the last 50 lines are kept, and the last 300 characters of them go into the classified error's message, which the failure record stores.

### 13.5 Dashboards & alerts (committed under `infra/observability/`)

The files live under `infra/observability/`. Dashboards (`infra/observability/dashboards/*.json`, provisioned into the compose Grafana, and copied into `infra/k8s/base/dashboards-configmaps.yaml`, which `dashboards.test.ts` holds equal): **Pipeline Overview** (videos by status, throughput in jobs/min, time-to-ready p50/p95 and by duration bucket), **Queues** (per-queue jobs by state, replicas vs outstanding backlog - the autoscaling proof graph, oldest waiting age, wait p95), **Workers** (job duration p50/p95, realtime factor, ffmpeg exits by stage and code, tmp bytes, DLQ entries), **API** (RED, SSE connections and events published, requests in flight), **Storage & Cost** (Class A/B ops per hour, projected monthly Class A ops, output bytes, storage op p95, Grafana Cloud active series).

Alert rules (`infra/observability/alerts/video-pipeline-alerts.yaml`, a Prometheus rule file the compose Prometheus loads; the k8s manifests carry no `PrometheusRule`). Each rule names a runbook under `docs/runbooks/`:

| Alert | Expression (sketch) | For | Severity |
|---|---|---|---|
| `DLQNotEmpty` | `increase(dlq_entries_total[10m]) > 0` | 0m | warning |
| `QueueStarvation` | `bullmq_queue_oldest_waiting_age_seconds > 900` | 5m | warning |
| `JobFailureRateHigh` | `sum by (queue) (rate(jobs_processed_total{result="failed"}[10m])) / sum by (queue) (rate(jobs_processed_total[10m])) > 0.05` | 10m | critical |
| `SystemicFailure` | same ratio over `[5m]`, `> 0.5` | 5m | critical (runbook: pause queue) |
| `WorkerStalledJobs` | `sum by (queue) (increase(jobs_processed_total{result="stalled"}[30m])) > 3` | 0m | warning |
| `WorkerStuck` | `processing_steps_running_stale > 0` (the API's SQL poller: `RUNNING` steps with a heartbeat older than 5 min) | 5m | warning |
| `ScaleToZeroBroken` | `sum(max by (queue, state) (bullmq_queue_jobs{state=~"waiting\|prioritized"})) > 0 and on() sum(kube_deployment_status_replicas{deployment=~"vp-worker-.*"}) == 0` | 3m | critical (k8s only) |
| `R2ClassABudget` | `predict_linear(storage_ops_total{op="put"}[1d], 30*86400) > 900000` | 1h | info |
| `APILatencyHigh` | `histogram_quantile(0.95, sum by (le) (rate(http_request_duration_seconds_bucket[5m]))) > 0.2` | 10m | warning |
| `WorkerTmpDiskHigh` | `worker_tmp_bytes / 8e9 > 0.8` | 5m | warning |

The compose Alertmanager (`infra/compose/alertmanager/alertmanager.yml`) routes by severity to placeholder webhooks on `http://localhost:5001`; no chat or paging receiver is configured, locally or in cloud.

---

## 14. Distributed Load Testing & Chaos Plan

### 14.1 Principles

- **Synthetic media only.** `packages/server/gen-video` produces deterministic sources with `ffmpeg -f lavfi -i testsrc2=size=1920x1080:rate=24 -f lavfi -i sine=frequency=440 -t {sec}` at 15 s / 60 s / 10 min / 30 min and a "hostile" set (truncated file, audio-only, 4K/60fps, rotated portrait, HEVC-in-MKV). Checked into `packages/server/gen-video/manifest.json`, generated on demand (never committed as binaries).
- **Every scenario has a threshold** (k6 `thresholds`) so it can fail CI, and a **Grafana snapshot** committed under `docs/load-tests/results/<date>-<scenario>/`.
- **Two execution modes:** `k6 run` from the laptop against compose (Phases 2–3), and **k6-operator** `TestRun` CRDs inside the k3d/k3s cluster with `parallelism: N` for distributed runs (Phase 3–4). Optional: Grafana Cloud k6 (500 VU-h/month free) for a cloud-sourced run against the reference deployment.
- k6 outputs to Prometheus remote-write (`K6_PROMETHEUS_RW_SERVER_URL`) so load-generator metrics and system metrics sit on the same dashboard timeline.

### 14.2 Scenarios

| # | Scenario | What it proves | k6 shape | Pass thresholds | Chaos injected |
|---|---|---|---|---|---|
| S1 | **Upload storm** | API is not in the data path; presign/complete scale | `ramping-vus` 0→500 over 5 min, hold 10 min; each VU: `POST /uploads` (20 MB synthetic) → 3 multipart PUTs to storage → `complete` | `http_req_duration{route:presign} p95<200ms`, `p99<500ms`; API container network I/O flat vs file size; `checks>99.5%`; 0 `5xx` | none |
| S2 | **Large file** | Streaming end-to-end, bounded memory/disk | 5 VUs each uploading a 4 GB synthetic source as 64 × 64 MB parts (concurrency 4), followed by full processing of a 30-min 1080p source | API RSS < 300 MB throughout; worker RSS < 2 GB; `worker_tmp_bytes` never > source + 1 segment; `ListParts` resume works after killing the VU at 50 % | VU killed mid-upload and resumed |
| S3 | **Backlog burst / queue starvation** | Autoscaling, fairness, drain time | `shared-iterations` 1 000 uploads of the 15 s source in 60 s (one user = 700, nine users = 300) | KEDA reaches `maxReplicaCount` ≤ 60 s after backlog appears; drain time recorded; `bullmq_queue_oldest_waiting_age_seconds` for the nine small users < 2× that of the big user (admission control working); 0 DLQ | none |
| S4 | **Worker node failure recovery** | Stalled detection, idempotent redo, effectively-once | 50 × 60 s sources in flight; chaos script kills pods | Every video reaches READY; `stalled` counter > 0; exactly one `video.ready` event per video; `segment_count` matches; no orphan keys (`ListObjects` audit) | `kubectl delete pod -l stage=transcode-720p` every 45 s for 5 min; `docker kill -s KILL` in compose mode |
| S5 | **Dependency outage** | Backoff, DLQ, circuit runbook | 30 videos in flight | Storage 503 for 60 s → all videos READY (retries visible); storage down 15 min → jobs land in DLQ after 4 attempts, `SystemicFailure` fires, **replay** from DLQ succeeds; Redis restart → no lost videos (reconciler) | `toxiproxy` in front of MinIO (latency 2 s, 503 injection); `docker restart redis`; `iptables` drop for Neon in cloud |
| S6 | **SSE fan-out** | Real-time path scales | 5 000 VUs open `/videos/:id/events` across 200 videos while S3 runs | `sse_connections=5000` on one API pod, RSS < 512 MB; publish→receive p95 < 2 s (k6 measures timestamp in event payload); reconnect with `Last-Event-ID` yields no gaps | API pod restart mid-test (clients must reconnect and receive snapshot) |
| S7 | **Soak** | Leaks, disk hygiene, scheduler drift | 4 h at 1 upload/10 s (60 s source) | Flat RSS trend (< 5 %/h) on API and workers; `/tmp/vp` empty between jobs; `videos_by_status{PROCESSING}` returns to 0; Neon autosuspends between reconciler runs | none |

### 14.3 k6 sketch (S1 core)

```js
// load-tests/k6/scenarios/s1-upload-storm.js
import http from 'k6/http';
import { check } from 'k6';
import { randomBytes } from 'k6/crypto';
export const options = {
  scenarios: { storm: { executor: 'ramping-vus', stages: [{ duration: '5m', target: 500 }, { duration: '10m', target: 500 }, { duration: '1m', target: 0 }] } },
  thresholds: {
    'http_req_duration{name:presign}':  ['p(95)<200', 'p(99)<500'],
    'http_req_duration{name:complete}': ['p(95)<300'],
    'checks': ['rate>0.995'],
  },
};
const PART = 8 * 1024 * 1024, PARTS = 3;
export default function () {
  const h = { headers: { Authorization: `Bearer ${__ENV.TOKEN}`, 'Content-Type': 'application/json' } };
  const up = http.post(`${__ENV.API}/v1/uploads`, JSON.stringify({ filename: 'synthetic.mp4', sizeBytes: PART * PARTS, contentType: 'video/mp4' }), { ...h, tags: { name: 'presign' } });
  check(up, { 'presign 201': (r) => r.status === 201 });
  const { uploadId, parts } = up.json();
  const etags = parts.slice(0, PARTS).map((p) => {
    const r = http.put(p.url, randomBytes(PART), { headers: { 'Content-Type': 'video/mp4' }, tags: { name: 'storage-put' } });
    return { partNumber: p.partNumber, etag: r.headers['Etag'] };
  });
  const done = http.post(`${__ENV.API}/v1/uploads/${uploadId}/complete`, JSON.stringify({ parts: etags }), { ...h, tags: { name: 'complete' } });
  check(done, { 'complete 202': (r) => r.status === 202 });
}
```

(For S1 the bytes are random, so `probe` will fail with `CORRUPT_CONTAINER` and exercise the DLQ path on purpose; S3–S7 upload real synthetic MP4s via `open()` + `SharedArray`.)

### 14.4 Chaos tooling

`tools/chaos/` — small scripts, not a platform: `kill-worker.sh` (random pod of a stage every N s), `toxiproxy` compose profile for MinIO (latency, timeout, 503 via `http` toxic on a tiny proxy), `redis-restart.sh`, `disk-fill.sh` (fills the worker `emptyDir` to trigger `ENOSPC` handling). Chaos Mesh is deliberately not used — the point is to understand the failure, not to operate a chaos platform.

### 14.5 Reporting

`docs/load-tests/README.md` records, per run: commit SHA, hardware, scenario, thresholds pass/fail, drain time, realtime factors, Grafana snapshot PNG, and one paragraph of interpretation. The Phase 3 exit criterion is a table with S1–S3 filled; Phase 4 completes S4–S7.

---

## 15. Repository Structure, Tooling & External Services

### 15.1 Repository layout (monorepo `video-pipeline`)

```
video-pipeline/
├── packages/                               # every workspace library; the directory IS the runtime tier (ADR-23)
│   ├── universal/                          # runs in a browser AND on a server: no node:*, no server SDK
│   │   ├── api-contracts/                  # zod schema per endpoint: params, query, body, response; problem+json
│   │   ├── domain/                         # entities, value objects, ranking & eligibility policy, the status vocabulary
│   │   ├── domain-rules/                   # policy, invariants and state transitions over an entity; returns Result (ADR-24)
│   │   ├── errors/                         # ErrorCodes, Failure, RETRY_CLASS, Permanent/TransientError, infra failure factories
│   │   ├── pagination/                     # CursorCodec, Paginator, PAGE_SIZE_DEFAULT/MAX
│   │   ├── permissions/                    # CASL rules, normalizers, canX helpers, assertCan
│   │   ├── result/                         # Result<T,E>, combinators, tryCatch/fromPromise, assertNever
│   │   ├── tsconfig/                       # base + server/universal/client/spec presets
│   │   └── validation/                     # predicates over submitted input only, ALLOWED_CONTENT_TYPES
│   ├── client/                             # browser only
│   │   └── api-client/                     # typed fetchers mapped from @vp/api-contracts; base URL injected
│   └── server/                             # Node/Bun only
│       ├── core/                           # @vp/core: ports/ (abstract classes) and repositories/ (interfaces)
│       ├── adapters/                       # @vp/adapters: auth, authorization, bullmq, postgres, redis, s3, metered, in-memory
│       │   ├── composition/                # adapter tokens + registerAdapters: the one in-memory/external switch
│       │   └── __tests__/contract/         # one conformance suite per repository, run against both families (PGlite)
│       ├── composition/                    # Token<T>, Container (start/dispose), shutdownOnce (ADR-25)
│       ├── concurrency/                    # Singleflight
│       ├── config/                         # loadEnv(): reads process.env against @vp/env-schema; register.js resolve hook
│       ├── env-schema/                     # AppEnv, platform-env.json, SECRET_KEYS, AppConfig + toAppConfig, tuning.ts
│       ├── db/                             # drizzle schema, client, migrate and seed library; migrations in drizzle/
│       ├── events/                         # Redis Pub/Sub channels, SSE envelope schemas, cache keys
│       ├── ffmpeg/                         # probe, transcode/thumbnail/sprite args, runFfmpeg, error classification, master playlist
│       ├── job-contracts/                  # job payload schemas, jobId builders, stage policies, queue names, the rendition ladder
│       ├── logger/                         # @vp/logger: pino, json and pretty formats, LogContext
│       ├── observability/                  # prom-client registry and metrics server, OpenTelemetry bootstrap
│       ├── storage/                        # keys.ts, mime.ts, multipart.ts (part math/constants)
│       ├── testing/                        # vitest config factory + shared fixtures and helpers
│       └── compose-autoscaler/ dev-token/ gen-video/ upload-client/   # CLI packages
├── apps/
│   ├── api/                                # Node 24 · Fastify 5
│   │   ├── src/
│   │   │   ├── main.ts                     # reads process.env, calls run() in process.ts
│   │   │   ├── process.ts · serve.ts       # loadEnv -> toAppConfig -> composeApp -> start -> listen; drained shutdown
│   │   │   ├── instrument.ts               # tracing preload (--import ./dist/instrument.js)
│   │   │   ├── app.ts                      # composeApp(): container, plugins, the route table
│   │   │   ├── migrate.ts · seed.ts        # pnpm db:migrate (also the compose/k8s migrate job) and pnpm db:seed
│   │   │   ├── composition/                # services.module.ts, adapter-set.ts (the test override seam), openapi, bull-board
│   │   │   ├── plugins/                    # auth, errors, access-log, request-id, request-span, route-label, http-metrics
│   │   │   ├── routes/                     # thin transport adapters; sendResult unwraps the Result; admin/
│   │   │   └── services/                   # deep domain services, SSE hub, queue and SQL pollers, housekeeping schedulers
│   │   └── Dockerfile
│   ├── worker/                             # Bun 1.4 by default, Node 24 with WORKER_RUNTIME=node · one image, WORKER_STAGE picks the role
│   │   ├── src/
│   │   │   ├── main.ts · process.ts        # loadEnv -> toAppConfig -> runner; drained shutdown
│   │   │   ├── instrument.ts               # tracing preload
│   │   │   ├── runner.ts                   # composition root: registerAdapters + stages.module over one container
│   │   │   ├── composition/                # stages.module.ts: consumer, outbox relay, metrics and heartbeat as Startables
│   │   │   ├── registry.ts                 # per stage: queue, processor, concurrency, lock and shutdown settings
│   │   │   ├── with-telemetry.ts           # traceparent extraction and the bullmq.process span
│   │   │   ├── failure-handler.ts          # DLQ pattern: dlq_entries + dlq queue + rendition/video state
│   │   │   ├── heartbeat.ts                # the liveness file timer
│   │   │   └── stages/                     # probe, transcode, thumbnail, package, notify, segment-uploader; housekeeping/
│   │   └── Dockerfile                      # ARG WORKER_RUNTIME=bun|node
│   └── web/                                # React 18 · Create React App 5 (craco) · RTK Query · Bootstrap
│       └── src/                            # modules/ (pages), components/can.tsx, hooks/use-can.ts
├── infra/
│   ├── compose/                            # docker-compose.yml (+ offline, chaos, toxiproxy files), minio-init.sh, prometheus, alertmanager, grafana, tempo, loki, otel-collector
│   ├── k8s/
│   │   ├── base/                           # namespace, api, vp-worker-<stage> deployments, scaled-objects, configmap-secret, service-monitors, dashboards-configmaps
│   │   ├── overlays/local/                 # k3d/kind: local images
│   │   ├── overlays/cloud/                 # ExternalSecret, cloudflared, Alloy, in-cluster Redis, maxReplicaCount 1
│   │   └── helm-values/                    # keda, kube-prometheus-stack, redis, minio, postgres
│   ├── terraform/                          # cloudflare (R2 buckets, custom domain, tunnel, DNS, Access, scoped tokens), hetzner (server, firewall)
│   └── observability/
│       ├── dashboards/                     # api.json, pipeline.json, queues.json, storage-cost.json, workers.json
│       └── alerts/                         # video-pipeline-alerts.yaml (Prometheus rule file)
├── tests/
│   ├── architecture/                       # the invariant suite (pnpm test:architecture)
│   ├── e2e/                                # acceptance suite (make e2e)
│   ├── in-process/                         # boots the composition roots in one process: start order, request correlation
│   └── load/                               # k6 scenarios s1-upload-storm.js … s7-soak.js, common.js, a k6-operator TestRun
├── scripts/                                # repo tooling run on tsx or sh: boundaries, e2e runner, chaos, bundle-app, cloud setup
├── tools/                                  # non-package assets only (no package.json, no tier)
│   ├── hls-test-page/                      # index.html with vendored hls.js: paste a videoId, play master.m3u8, see the SSE log
│   └── chaos/                              # kill-worker.sh, redis-restart.sh, disk-fill.sh, toxiproxy-toxic.sh
├── docs/
│   ├── PRD.md · SDD.md · LOCAL_FIRST.md
│   ├── standards/ · agents/ · reviews/ · diagrams/
│   ├── tickets/                            # tracer-bullet tickets and the generated index
│   ├── runbooks/                           # one per alert, plus cloud-accounts.md
│   └── load-tests/                         # README and results/<date>-<scenario>/
├── .github/workflows/
│   ├── ci.yml                              # build · lint-typecheck · unit · unit-bun · integration · e2e · publish-images
│   ├── images.yml                          # buildx -> ghcr.io/szebest/vp-api, vp-worker (tags: git tag, sha, latest/node) · Trivy scan
│   ├── load-smoke.yml                      # nightly and on load-test changes: compose up -> reduced S1 -> thresholds
│   ├── deploy-cloud.yml                    # on a v* tag: kustomize the cloud overlay and apply it
│   └── sync-tickets.yml                    # mirrors docs/tickets to GitHub issues
├── .env.example                            # §16, the env contract for api + worker
├── package.json · pnpm-workspace.yaml · turbo.json · tsconfig.base.json · docker-bake.hcl
├── biome.json · knip.json · lefthook.yml · renovate.json
├── Makefile                                # make up / down / up-all / obs-up / k3d-up / k3d-deploy / load-s1 / chaos-s4 / smoke / e2e
└── README.md
```

Package naming: `@vp/<name>` for every package, `@vp/api`, `@vp/worker` and `@vp/web` for the apps. Dependencies flow **apps -> packages** only, and between packages strictly down the `vp.layer` each `package.json` declares; `pnpm boundaries` fails on a violation (ADR-23).

### 15.2 Toolchain

| Concern | Choice | Version (2026-09) | Notes |
|---|---|---|---|
| Package manager / workspaces | pnpm | 10.x | `pnpm deploy --prod` for slim images |
| Task runner / cache | Turborepo | 2.x | remote cache optional (Vercel free) |
| Language | TypeScript | 5.x, `strict`, `noUncheckedIndexedAccess`, ESM | |
| API runtime | Node.js | 24 LTS (v26 becomes LTS 2026-10-28 — upgrade in Phase 4) | |
| Worker runtime | Bun | 1.4.x by default, Node 24 with `WORKER_RUNTIME=node` | |
| HTTP | Fastify 5 + `fastify-type-provider-zod`, `@fastify/rate-limit`, `@fastify/swagger`, `@fastify/cors`, `@fastify/helmet` | | JWTs verified by the `TokenVerifier` adapters, not a Fastify plugin |
| Queue | BullMQ 6 + ioredis 5 | | `@bull-board/api` + `@bull-board/fastify` |
| DB | PostgreSQL 16, Drizzle ORM 0.45 (1.0 when GA) + drizzle-kit, `postgres` (postgres.js) driver | | |
| Storage | `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`, `@aws-sdk/lib-storage` | 3.x | |
| Media | FFmpeg 7.x (system package in image), `packages/server/ffmpeg` wrapper (argv builder + progress parser) | | no fluent-ffmpeg (unmaintained) |
| Validation | zod 3 | | |
| IDs | `uuidv7` | | |
| Logging | pino 10 through `@vp/logger`, JSON or its own pretty destination | | |
| Metrics | prom-client 15 | | |
| Tracing | `@opentelemetry/sdk-node`, auto-instrumentations-node, exporter-trace-otlp-http | | |
| Testing | vitest 3, PGlite for the Postgres repositories in unit specs, `bun test` for worker and package parity, `app.inject()` for routes | | the `integration` job's services are CI service containers |
| Lint/format | Biome 1.9, `--error-on-warnings` | | one tool, fast |
| Git hooks | lefthook | | typecheck + biome on staged |
| Containers | Docker 27 + buildx, Compose v2 | | |
| Local Kubernetes | k3d (or kind) + kubectl + kustomize + helm | k3d 5.x | |
| Autoscaling | KEDA 2.21 (chart pinned in the Makefile) | | |
| Monitoring | kube-prometheus-stack (Prometheus 3, Grafana 12, Alertmanager), Tempo 2, Loki 3, Grafana Alloy / otel-collector-contrib | | |
| Load testing | k6 2.x, k6-operator 1.6 | | |
| Chaos | toxiproxy 2.x, shell scripts | | |
| Secrets (cloud) | External Secrets Operator: one `ExternalSecret` entry per `SECRET_KEYS` member, no ciphertext in the repo | | |
| IaC (cloud) | Terraform 1.x with `cloudflare` and `hcloud` providers (optional) | | |
| CI/CD | GitHub Actions, GHCR, Renovate | | |
| API docs | OpenAPI 3.1 via `@fastify/swagger` + Scalar UI | | |

### 15.3 External services & accounts to create (all free unless noted)

> **None of these are needed to develop, test, load-test or demo the system.** The entire architecture runs locally in Docker Compose (P9, PRD G11). Create these accounts only when you start Phase 4 (ticket 31); until then the *Needed from* column is the only thing that matters.

| Service | Purpose | Sign-up / docs | Free-tier facts (verified 2026-09-03) | Needed from |
|---|---|---|---|---|
| **GitHub** (repo `szebest/video-pipeline`, Actions, GHCR, Renovate) | Source, CI, multi-arch image registry | github.com | Actions free for public repos; GHCR free for public images | Phase 0 |
| **Cloudflare** account + a domain (or a free `*.workers.dev`-style subdomain is *not* enough for R2 custom domain — a real domain ≈ €5–10/yr is the one unavoidable cost if you want a CDN hostname; otherwise use R2's presigned GETs) | DNS, CDN in front of R2, **R2** buckets, **Tunnel** to the VPS, Zero Trust Access for `/admin` | dash.cloudflare.com → R2; developers.cloudflare.com/r2 | R2: 10 GB, 1 M Class A, 10 M Class B / month, $0 egress; Zero Trust free ≤ 50 seats | Phase 4 (R2 from Phase 2 optional) |
| **Backblaze B2** (fallback) | S3-compatible storage | backblaze.com/cloud-storage | 10 GB free; egress free to Cloudflare; 3× storage/month elsewhere | optional |
| **Neon** | Serverless Postgres | neon.com | 0.5 GB, 100 CU-h/month, autosuspend after 5 min, 100 projects | Phase 4 |
| **Supabase** (fallback / auth) | Postgres or Auth | supabase.com | 500 MB, 2 projects, pauses after 1 week idle | optional |
| **Grafana Cloud** | Hosted Prometheus/Loki/Tempo, IRM, k6 cloud | grafana.com | 10k series, 50 GB logs, 50 GB traces, 14-day retention, 500 k6 VU-h | Phase 4 |
| **Hetzner Cloud** | VPS for k3s (paid) | console.hetzner.cloud | CAX11 €5.99 / CX23 €5.49 per month + IPv4 €0.50 (ex-VAT), 20 TB traffic | Phase 4 |
| **Oracle Cloud** (alternative) | Always Free Arm VM | cloud.oracle.com | 2 OCPU / 12 GB A1 (since 2026-06-15), 200 GB block, 10 TB egress; capacity errors common; idle reclamation | Phase 4 |
| **Docker Hub** (read-only pulls) / GHCR | Base images | | rate limits: authenticate in CI | Phase 0 |
| **Sentry** (optional) | Error tracking | sentry.io | 5k errors/month | optional |
| **Discord or Telegram** bot webhook | Alertmanager notifications | | free | Phase 3 |
| **Renovate** GitHub app | Dependency updates | github.com/apps/renovate | free | Phase 0 |
| **Vercel** (optional) | Turborepo remote cache | vercel.com | free hobby | optional |

Local tools to install: Docker Desktop/Engine + Compose, Node 24 (via `fnm`/`volta`), Bun 1.4, pnpm 10 (`corepack enable`), `ffmpeg`/`ffprobe` (for `packages/server/gen-video` and local unit tests), `k3d` or `kind`, `kubectl`, `helm`, `kustomize`, `k6`, `mc` (MinIO client, optional), `cloudflared` (Phase 4), `terraform` (optional), `sops` + `age` (Phase 4).

Useful references (bookmarks): docs.bullmq.io (Flows, Retrying failing jobs, Going to production, Job Schedulers) · keda.sh/docs (Prometheus & Redis scalers, ScaledObject spec) · developers.cloudflare.com/r2 (S3 API compatibility, presigned URLs, event notifications) · developer.apple.com HLS Authoring Specification · ffmpeg.org/ffmpeg-formats.html#hls-2 · orm.drizzle.team · fastify.dev · opentelemetry.io/docs/languages/js · grafana.com/docs/k6 · neon.com/docs · bun.com/docs.

---

## 16. Environment Variables

One contract for both apps, declared with zod in `packages/server/env-schema` and loaded by `packages/server/config` (fail fast on boot with a readable list of missing/invalid keys). Full annotated template: `.env.example` at the repo root. Secrets are marked 🔒 and carry no default (§11).

Two schemas, each with named consumers. `AppEnv` (`app-env.ts`) is what `toAppConfig()` reads, and every key in it reaches a consumer: `env-keys-consumed.test.ts` checks every `AppEnv` key is read by `toAppConfig` and every `AppConfig` leaf is read by production source outside `env-schema`. `platform-env.json` is the short list of keys this repo hands to something else, each naming the consumer beside it: data, since no code of ours reads them. Tuning with no key of its own (cache TTLs, housekeeping thresholds, the outbox cadence, the segment uploader's retries) is declared once, as a named constant in `tuning.ts`; no service, stage or adapter holds a numeric default (`no-tuning-literals.test.ts`).

The schema is **closed over what the code reads**: every key the deployables read is declared, every declared key is uncommented in `.env.example`, and every key compose, the k8s base and overlays, CI steps and `make` hand the apps is declared (`env-key-closure.test.ts`). `process.env` is read only in the entrypoints and env homes `tests/architecture/entrypoints.ts` lists; everything below takes the `AppConfig` value `toAppConfig()` shapes (ADR-25).

### 16.1 Core

| Variable | Used by | Default | Notes |
|---|---|---|---|
| `NODE_ENV` | both | `development` | `development` · `test` · `production`; `production` turns on the refusals of §11, `test` silences logs and turns tracing off |
| `LOG_LEVEL` | both | `debug` | pino level: `trace` · `debug` · `info` · `warn` · `error` |
| `SERVICE_VERSION` | both | `dev` | OTel resource attribute; nothing in the images or manifests sets it. The service name is set in code (`vp-api`, `vp-worker-<stage>`) |
| `ADAPTER_FAMILY` | both | `external` | `in-memory` only for in-process tests; the one switch `registerAdapters` reads |
| `CORS_ORIGINS` | api | `http://localhost:5173,http://localhost:8080` | comma list of frontend origins; production refuses empty or `*` |
| `TRUST_PROXY` | api | empty | comma list of proxy addresses/CIDRs whose `X-Forwarded-For` is trusted |
| `HTTP_BODY_LIMIT_BYTES` | api | `1048576` | JSON body cap; media goes straight to S3 |
| `PORT` | api | `3000` | HTTP listener; `0` picks a free port |
| `METRICS_PORT` | both | `9464` | `/metrics` on a separate port; `0` picks a free port |
| `PAGE_SIZE_DEFAULT` / `PAGE_SIZE_MAX` | api | `20` / `100` | keyset page size when `?limit` is omitted, and the most a request gets (a larger `limit` is clamped) |

### 16.2 PostgreSQL

| Variable | Default / local | Cloud (Neon) |
|---|---|---|
| `DATABASE_URL` 🔒 | required, no default; local `postgres://vp:vp@localhost:5432/vp` | `postgresql://user:pass@ep-xxx.eu-central-1.aws.neon.tech/vp?sslmode=require` (pooled endpoint `-pooler` for the API) |
| `DATABASE_URL_MIGRATIONS` 🔒 | empty (= `DATABASE_URL`) | Neon **direct** (non-pooled) URL |
| `DATABASE_POOL_MAX` | `10` | `5` per pod (Neon free ≈ 100 connections via pooler) |

`pnpm db:migrate` (`apps/api/src/migrate.ts`, also the k8s migrate Job) migrates and nothing else. `pnpm db:seed` (`apps/api/src/seed.ts`) writes the dev user and a READY video, and refuses `NODE_ENV=production`; compose runs both for local development.

### 16.3 Redis (BullMQ + Pub/Sub)

| Variable | Default | Notes |
|---|---|---|
| `REDIS_URL` | `redis://localhost:6379/0` | queues and cache; `rediss://` for TLS; no credential in the URL |
| `REDIS_PUBSUB_URL` | `redis://localhost:6379/1` | the connection publish and subscribe use |
| `REDIS_PASSWORD` 🔒 | none; local `vp` | handed to BullMQ and to the cache client |
| `BULLMQ_PREFIX` | `bull` | queue and flow key prefix; must match the KEDA redis trigger's `listName` prefix |

### 16.4 Object storage (S3-compatible)

| Variable | MinIO (default) | Cloudflare R2 | Backblaze B2 |
|---|---|---|---|
| `S3_ENDPOINT` | `http://localhost:9000` | `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` | `https://s3.<region>.backblazeb2.com` |
| `S3_REGION` | `us-east-1` | `auto` | `<region>` e.g. `eu-central-003` |
| `S3_FORCE_PATH_STYLE` | `true` | `false` | `false` |
| `S3_ACCESS_KEY_ID` 🔒 | none; local `minioadmin` | R2 API token -> Access Key ID | B2 application keyID |
| `S3_SECRET_ACCESS_KEY` 🔒 | none; local `minioadmin` | R2 Secret Access Key | B2 applicationKey |
| `S3_BUCKET_RAW` | `raw` | `vp-raw` | `vp-raw` |
| `S3_BUCKET_PUBLIC` | `public` | `vp-public` | `vp-public` |
| `S3_PRESIGN_TTL_SEC` | `900` | `900` | `900` |
| `CDN_BASE_URL` | `http://localhost:9000/public` | `https://cdn.example.com` (R2 custom domain) | `https://cdn.example.com` (Cloudflare -> B2) |
| `S3_MULTIPART_THRESHOLD_BYTES` | `104857600` (100 MB) | same | same |
| `S3_PART_SIZE_MIN_BYTES` / `S3_PART_SIZE_MAX_BYTES` | `8388608` / `67108864` | same | same |
| `RAW_RETENTION_DAYS` | `7` | `7` | `7` |

The two bucket keys are the only spelling: every reader in both apps takes them through `AppConfig.buckets`. Terraform issues the API and the worker different R2 tokens with the scopes in §11; the env names are identical, the values differ per deployment.

### 16.5 Auth

| Variable | Default | Notes |
|---|---|---|
| `AUTH_MODE` | `dev` | `dev` (the `pnpm dev-token` key) or `jwks` (your IdP); production refuses `dev` |
| `AUTH_JWKS_URL` | empty | your IdP's key set, e.g. `https://<idp>/.well-known/jwks.json`; required when `AUTH_MODE=jwks` |
| `AUTH_ISSUER` / `AUTH_AUDIENCE` | `vp-dev` / `vp-api` | compared to `iss` and `aud`, in both modes |
| `AUTH_ALGORITHMS` | `RS256,ES256` | comma list from `RS256/384/512`, `ES256/384/512`, `EdDSA`: the algs a jwks token may use |
| `AUTH_DEV_USER_ID` | `00000000-0000-7000-8000-000000000001` | dev mode: the provisioned user `ADMIN_TOKEN` acts as |
| `ADMIN_TOKEN` 🔒 | none; `.env.example` ships `change-me-32-bytes-random` | dev mode `x-admin-token` for admin routes and Bull Board; unset admits nobody; production refuses any value |

### 16.6 Pipeline tuning

| Variable | Default | Notes |
|---|---|---|
| `WORKER_STAGE` | `probe` | `probe` · `transcode-1080p` · `transcode-720p` · `transcode-480p` · `thumbnail` · `package` · `notify` · `housekeeping` |
| `WORKER_CONCURRENCY` | empty = the stage's registry value | override |
| `FFMPEG_PATH` / `FFPROBE_PATH` | `ffmpeg` / `ffprobe` | the binaries the stages spawn |
| `FFMPEG_THREADS` | `2` | k8s sets it from the container's CPU limit (`resourceFieldRef`) |
| `X264_PRESET` | `veryfast` | load-test variable |
| `HLS_SEGMENT_SECONDS` | `6` | `-hls_time` |
| `GOP_SECONDS` | `2` | GOP = `round(GOP_SECONDS × fps)`, a forced keyframe every `GOP_SECONDS` |
| `MAX_UPLOAD_BYTES` | `4294967296` | 4 GB |
| `MAX_DURATION_SEC` | `3600` | probe refuses a longer source with `DURATION_EXCEEDED` |
| `JOB_TIMEOUT_FACTOR` | `3` | transcode hard timeout = max(factor × duration, 10 min) |
| `MAX_INFLIGHT_PER_USER` | `3` | admission control |
| `UPLOAD_RATE_LIMIT_MAX` | `30` | `POST /v1/uploads` per user per minute; raise for load tests |
| `TMP_DIR` | `/tmp/vp` | emptyDir/tmpfs; probe, transcode and thumbnail work under it and housekeeping sweeps it |
| `SSE_HEARTBEAT_MS` | `15000` | |
| `SSE_MAX_PER_USER` / `SSE_MAX_PER_POD` | `20` / `5000` | |
| `SPRITE_INTERVAL_SECONDS` | `5` | thumbnail sprite frame interval (PRD OQ-4) |
| `WORKER_HEARTBEAT_PATH` | `/tmp/vp/heartbeat` | the file the worker liveness probe reads |

The upload content types are a typed constant in `@vp/validation` that the browser shares, not configuration.

### 16.7 Observability

| Variable | Default | Grafana Cloud |
|---|---|---|
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `http://localhost:4318` | the cloud overlay points the apps at `http://alloy:4318`; Alloy forwards to `GRAFANA_OTLP_ENDPOINT` (§16.8) |
| `OTEL_TRACES_SAMPLER` / `OTEL_TRACES_SAMPLER_ARG` | `parentbased_always_on` / `1.0` | see §13.3 for the values the code understands |
| `OTEL_RESOURCE_ATTRIBUTES` | `deployment.environment=local` | `deployment.environment=cloud` |

`PROMETHEUS_REMOTE_WRITE_URL`, `LOKI_URL` and `SENTRY_DSN` appear only as comments in `.env.example`; no process of ours reads them. The k6 scripts in `tests/load` read `API`, `TOKEN`, `STORAGE_TARGET`, `KILL_AT_50` and `SOAK_DURATION` through k6's `__ENV`, outside the schema.

### 16.8 Platform keys (`platform-env.json`)

Handed to something other than this code, and declared so the schema stays closed:

| Variable | Consumer |
|---|---|
| `NODE_OPTIONS` | Node itself; the images and compose set `--import @vp/config/register` |
| `TURBO_TELEMETRY_DISABLED` / `DO_NOT_TRACK` | turbo and every tool honouring the convention (P9) |
| `GRAFANA_OTLP_ENDPOINT` / `GRAFANA_OTLP_HEADERS` 🔒 | Grafana Alloy's upstream (`Authorization=Basic <base64(instanceId:token)>`). Named apart from `OTEL_EXPORTER_OTLP_*` because `vp-secrets` reaches every app pod, and the OTel SDK there would read them in place of the ConfigMap's `http://alloy:4318` |
| `WORKER_RUNTIME` | the worker image `CMD` and the k8s worker command (`bun` or `node`) |
| `REDIS_ADDR` | the KEDA redis trigger (`addressFromEnv`) |
| `CLOUDFLARE_TUNNEL_TOKEN` 🔒 | `cloudflared` |

### 16.9 Cloud-only (not read by any process in this repo)

Terraform takes its credentials as variables, not environment keys: `cloudflare_api_token`, `cloudflare_account_id` and `hcloud_token` in `terraform.tfvars` (template `infra/terraform/terraform.tfvars.example`). No manifest carries an image pull secret, so the GHCR images must be public.

---

## 17. Fact Sheet (verified 2026-09-03)

Items the design leans on, re-checked against vendor sources on the document date. Re-verify before Phase 4 — free tiers moved three times in 2026 alone.

| Topic | Fact | Design impact |
|---|---|---|
| Cloudflare R2 | Free: 10 GB storage, 1 M Class A, 10 M Class B ops/month; $0 egress. S3 multipart ✔, presigned PUT/GET ✔ (≤ 7 d, no POST policy). Event notifications → Cloudflare Queues only. | Storage choice; explicit `complete` trigger (ADR-09); Class A budget alert. |
| Backblaze B2 | 10 GB free; free egress ≤ 3× storage, unlimited to Cloudflare (Bandwidth Alliance). Storage ≈ $6–7/TB. | Fallback storage. |
| Neon Free | 0.5 GB, 100 CU-h/month/project, autosuspend 5 min, 100 projects, 10 branches. | DB choice; keep reconciler cadence ≥ 15 min. |
| Supabase Free | 500 MB, 2 projects, paused after 1 week idle. | Fallback / auth only. |
| Upstash Redis Free | 500k commands/**month**, 256 MB; Upstash documents BullMQ but warns about polling cost. | Self-host Redis (ADR-05). |
| BullMQ | v6 (6.3.x, Sept 2026): ioredis optional peer dep, Job Schedulers replace repeatables, `Job#discard()` removed → `UnrecoverableError`. Queue names/job IDs cannot contain `:`. Flows ✔. Defaults: `lockDuration 30 s`, `stalledInterval 30 s`, `maxStalledCount 1`, `lockRenewTime = lockDuration/2`. Built-in `exponential/fixed` backoff with `jitter`; custom `backoffStrategy`. No native DLQ. | §9 throughout. |
| KEDA | v2.20.x; `redis` list scaler (`listName`, `listLength`, `activationListLength`); `prometheus` scaler (`serverAddress`, `query`, `threshold`, `activationThreshold`); `minReplicaCount` default 0; ScaledJob recommended for long per-event jobs (we use ScaledObject deliberately — ADR-12). | §13.2 |
| Bun | 1.4.0 (Aug 2026); acquired by Anthropic Dec 2025; BullMQ works via ioredis (not `Bun.redis`); historical issues with `child_process` stdio piping and AWS SDK stream hangs on 1.3.x — mitigated by runtime switch. | ADR-01 guard-rails. |
| Node.js | v24 Active LTS until 2026-10-20 (then Maintenance); v26 LTS from 2026-10-28. | Upgrade API base image in Phase 4. |
| Fastify / Drizzle / Prisma | Fastify 5.12; Drizzle 0.45 stable, 1.0 RC; Prisma 7 Rust-free by default, Prisma 8 RC tagged `latest`. | ADR-02/04. |
| Apple HLS Authoring Spec | Target duration SHOULD be 6 s; IDR every 2 s; segments MUST start with IDR; H.264 may be fMP4 or MPEG-TS; HEVC/AV1 MUST be fMP4. | §8, ADR-07. |
| k6 | 2.2.x; k6-operator 1.6.x maintained; Grafana Cloud k6 500 VU-h/month free. | §14. |
| Oracle Always Free | A1 allowance **2 OCPU / 12 GB** since 2026-06-15 (was 4/24); 200 GB block; 10 TB egress; capacity errors common; idle reclamation (< 20 % over 7 d). | ADR-15 ranking. |
| Hetzner | CX23 €5.49, CAX11 €5.99 (ex-VAT, + IPv4) after June 2026 adjustment; 20 TB traffic. | ADR-15 cost model. |
| Fly.io / Render / Koyeb | Fly: trial only, no free tier; Render: free web only, spins down 15 min, free Postgres expires 30 d, no free workers; Koyeb: one 0.1 vCPU free instance, scales to zero after 1 h. | Rejected for workers. |
| Grafana Cloud Free | 10k series, 50 GB logs, 50 GB traces, 14-day retention, 3 users, 500 k6 VU-h. | §12.3, §13. |
| GitHub | Actions free for public repos; GHCR free for public images. | CI/CD. |
| Cloudflare Zero Trust | Free plan ≤ 50 seats (Tunnel, Access). | Expose VPS without open ports; protect `/admin`. |

---

## 18. Implementation Roadmap

Each phase ends with a demo and a **Definition of Done** that is binary. Estimated effort assumes evenings/weekends; adjust freely, but do not reorder — every phase depends on the invariants of the previous one.

### Phase 0 — Bootstrap (≈ 1 week)

Build: monorepo (pnpm + Turborepo + Biome + vitest), `packages/server/{config,job-contracts,db,storage,ffmpeg,observability,events}` and `packages/universal/errors` skeletons with tests, compose infra (`postgres`, `redis`, `minio`, `minio-init`), Drizzle migration 0001, CI (`typecheck`, `lint`, `unit`, `integration` with service containers), multi-arch image build to GHCR, `packages/server/gen-video`, `packages/server/dev-token`, `tools/hls-test-page`.

**DoD:** `git clone && make up && pnpm test` green on a fresh machine; `pnpm gen-video 60s` produces a playable synthetic MP4; images published for `amd64`+`arm64`.

### Phase 1 — Walking skeleton (≈ 2 weeks)

Build: `POST /uploads` (single presigned PUT only) → `complete` (+ `HEAD` verify) → `probe` job → `transcode-720p` job → `package` (single rendition master) → `READY`; `GET /videos/:id` with polling; JWT auth with dev issuer; Bull Board mounted; pino + prom-client basics; worker `main.ts` with `WORKER_STAGE`.

**DoD:** Upload a 60 s synthetic video via curl script, watch status flip to `READY`, play it in `tools/hls-test-page`. Kill the transcode worker mid-job → job retried → still `READY`, exactly one `video.ready` event. Both runtimes pass worker tests in CI.

### Phase 2 — Real pipeline (≈ 3 weeks)

Build: multipart uploads with resume + sweeper + lifecycle rules; ladder selection; **Flows** fan-out to `transcode-{1080p,720p,480p}` + `thumbnail`, fan-in `package` with `getChildrenValues()`; segment uploader streaming as segments close; master playlist with `CODECS`/`BANDWIDTH`; SSE hub (snapshot, replay, heartbeat, backpressure); error taxonomy + `UnrecoverableError` on probe; retries with jitter; **DLQ** (queue + Postgres mirror) + admin replay/discard; fencing tokens + CAS transitions; `video_events`; reconciler schedulers; admission control per user; OpenAPI docs; hostile test-video set passing (each lands in DLQ with the right code).

**DoD:** [x] 20 mixed videos (15 s–10 min, incl. hostile set) uploaded concurrently → all terminal within 15 min on the laptop (passed in 86.7s; see [`docs/load-tests/results/2026-09-05-e2e/`](load-tests/results/2026-09-05-e2e/README.md)); every hostile file in DLQ with a correct `error_code`; replay of a transient DLQ entry succeeds; SSE shows per-rendition progress in the test page; `docs/runbooks/dlq-replay.md` written. [Tag: `phase2-done`]

### Phase 3 — Observe & scale (≈ 3 weeks)

Build: full metrics catalogue; OTel tracing across API → workers (traceparent in job data); Grafana dashboards + alert rules; Loki/Tempo via otel-collector; k3d overlay (Kustomize) with KEDA `ScaledObject`s (Prometheus scaler + Redis fallback), HPA for API, graceful shutdown with long grace periods, liveness via heartbeat file; `packages/server/compose-autoscaler` for the non-k8s path; k6 S1–S3 with thresholds; nightly `load-smoke` workflow.

**DoD:** On k3d: backlog of 1 000 probe jobs → KEDA scales `probe` and `transcode-*` to max within 60 s, drains, returns to 0 after cooldown — captured as a Grafana panel PNG in `docs/load-tests/results/`. One trace shows the full journey of a video. S1–S3 pass thresholds; results table committed.

### Phase 4 — Resilience & cloud (≈ 3–4 weeks)

Build: chaos scenarios S4–S7 with toxiproxy and kill scripts; transactional outbox (ADR-16 #2); `reconcile-processing`; Node 26 LTS upgrade for the API; cloud overlay: k3s on Hetzner CAX11 (or Oracle A1), Neon, R2 + custom-domain CDN, `cloudflared` Tunnel, Zero Trust on `/admin`, Grafana Alloy → Grafana Cloud, SOPS secrets, Terraform for Cloudflare/Hetzner; cost guardrails (Class A budget alert, `RAW_RETENTION_DAYS`); runbooks completed.

**DoD:** Public URL serving a `READY` video via CDN; monthly cost statement ≤ €6.5 (or €0 on Oracle); S4–S7 pass and are documented; a worker pod deleted mid-transcode in the cloud cluster recovers without operator action.

### Phase 5 — Stretch backlog (unscheduled)

Chunked parallel transcoding (§8.5) · CMAF/fMP4 + DASH manifest · a Go worker sibling consuming the same queues (proves the contract boundary) · BullMQ Pro groups or RabbitMQ implementation of the same topology as a comparative write-up · signed playback URLs · Redpanda tail of `video_events` for a search indexer · frontend integration with `youtube-frontend` (upload widget, SSE progress, hls.js player using `packages/server/events` types).

---

## 19. Risks, Open Issues, Future Work

| Risk / issue | Mitigation in this design | Owner / when |
|---|---|---|
| Free-tier volatility (Oracle, Hetzner, Fly changes in 2026) | Provider-agnostic edges; fallback ladder (§12.3); fact sheet re-verified before Phase 4 | Phase 4 |
| BullMQ 6 API drift (young major) | Pin minor; `packages/server/job-contracts` isolates option shapes; changelog watch via Renovate | continuous |
| Bun regressions | Runtime-neutral worker code, dual-runtime CI, `WORKER_RUNTIME` switch | continuous |
| 2-vCPU cloud node can only run one 1080p job | Accepted: scale-to-zero is the cost lever; parallelism demos run locally / burst instance | Phase 4 |
| Disk pressure on large sources | Segment streaming uploader, `emptyDir.sizeLimit`, `worker_tmp_bytes` alert, S2 test | Phase 2–3 |
| Redis single point of failure | Postgres is truth; reconciler rebuilds; AOF; documented RTO (minutes) | Phase 2 |
| Class A ops budget with many small videos | Segment length 6 s (fewer PUTs than 2–4 s), budget alert, projection panel | Phase 3 |
| Keyframe alignment for VFR sources | `-vsync cfr`/`fps` filter when probe detects VFR; documented caveat | Phase 2 |
| Auth provider undecided | JWKS-based verification fixes the interface; provider is config | Phase 1 (dev issuer), Phase 5 (real) |
| Domain name cost (only unavoidable spend besides VPS) | ≈ €5–10/yr; alternative: presigned GET playback without CDN for demos | Phase 4 |

Open issues carried from PRD §12: auth provider, public vs signed playback, source retention, sprite density.

---

## 20. Appendix — Job Contracts (code)

```ts
// packages/server/job-contracts/src/index.ts
import { z } from 'zod';

export const QUEUES = ['probe', 'transcode-1080p', 'transcode-720p', 'transcode-480p',
  'thumbnail', 'package', 'notify', 'housekeeping', 'dlq'] as const;
export type QueueName = (typeof QUEUES)[number];
export const RENDITIONS = ['1080p', '720p', '480p'] as const;
export type RenditionName = (typeof RENDITIONS)[number];

export const LadderEntry = z.object({
  name: z.enum(RENDITIONS), width: z.number().int().positive(), height: z.number().int().positive(),
  videoKbps: z.number().int().positive(), maxrateKbps: z.number().int().positive(), bufsizeKbps: z.number().int().positive(),
  audioKbps: z.number().int().positive(), profile: z.enum(['main', 'high']), level: z.string(),
});
export type LadderEntry = z.infer<typeof LadderEntry>;

const Base = z.object({
  videoId: z.string().uuid(),
  generation: z.number().int().min(1),
  traceparent: z.string(),                       // W3C trace context, injected by producer
});

export const ProbeJob     = Base.extend({ sourceKey: z.string() });
export const TranscodeJob = Base.extend({
  sourceKey: z.string(), rendition: LadderEntry, fps: z.number().positive(), durationMs: z.number().int().positive(),
  chunkIndex: z.number().int().min(0).optional(), chunkCount: z.number().int().min(1).optional(),   // Phase 5 chunked mode
});
export const ThumbnailJob = Base.extend({ sourceKey: z.string(), durationMs: z.number().int().positive(), forceFailure: z.boolean().optional() });
export const PackageJob   = Base.extend({ ladder: z.array(LadderEntry).min(1) });
export const NotifyJob    = z.object({
  videoId: z.string().uuid(), userId: z.string().uuid(),
  event: z.enum(['video.processing', 'video.ready', 'video.failed']),
  eventSeq: z.number().int(), payload: z.record(z.unknown()), traceparent: z.string(),
});
export const HousekeepingJob = z.object({
  task: z.enum(['reconcile-uploads', 'reconcile-processing', 'purge-deleted', 'expire-raw', 'tmp-sweep']),
});
export const DlqJob = z.object({
  originQueue: z.enum(QUEUES), originJobId: z.string(), payload: z.unknown(),
  error: z.object({ code: z.string(), message: z.string(), stack: z.string().optional(), unrecoverable: z.boolean() }),
  attemptsMade: z.number().int(), workerId: z.string(), failedAt: z.string().datetime(),
});

// Return values (used by package via getChildrenValues())
export const TranscodeResult = z.object({
  rendition: z.enum(RENDITIONS), playlistKey: z.string(), segmentCount: z.number().int(),
  bytes: z.number().int(), durationMs: z.number().int(), avgBitrateBps: z.number().int(), processingMs: z.number().int(),
});
export const ThumbnailResult = z.object({ posterKey: z.string(), spriteKey: z.string(), spriteVttKey: z.string() });

// Deterministic job ids — ':' is forbidden by BullMQ, so '--' is the separator
export const ids = {
  probe:     (v: string, g: number) => `${v}--probe--g${g}`,
  transcode: (v: string, r: RenditionName, g: number) => `${v}--transcode--${r}--g${g}`,
  thumbnail: (v: string, g: number) => `${v}--thumbnail--g${g}`,
  package:   (v: string, g: number) => `${v}--package--g${g}`,
  notify:    (v: string, e: string, seq: number) => `${v}--notify--${e}--${seq}`,
  dlq:       (q: string, j: string, a: number) => `${q}--${j}--a${a}`,
  replay:    (original: string, n: number) => `${original}--r${n}`,
};

// SSE event schemas (shared with the frontend later)
export const SseEvent = z.discriminatedUnion('event', [
  z.object({ event: z.literal('snapshot'), data: z.object({ videoId: z.string(), status: z.string(), progress: z.object({ overall: z.number(), byRendition: z.record(z.number()) }) }) }),
  z.object({ event: z.literal('progress'), data: z.object({ rendition: z.enum(RENDITIONS).optional(), percent: z.number(), overall: z.number() }) }),
  z.object({ event: z.literal('status'),   data: z.object({ status: z.string(), playbackUrl: z.string().url().optional(), error: z.object({ code: z.string(), message: z.string() }).optional() }) }),
]);
export type SseEvent = z.infer<typeof SseEvent>;
```

```ts
// packages/server/job-contracts/src/policies.ts — see §9.1 for the table these encode
export { defaultJobOptions, stagePolicies } from './options';
```

---

*End of SDD v1.0. Changes to this document go through a PR that also updates the affected ADR and, where relevant, `.env.example`.*
