# Local-First & Offline Architecture (PRD G11, FR-19, SDD P9)

The `video-pipeline` system is engineered from the ground up to be **local-first**: after an initial one-time dependency installation and Docker image pull, the entire ingestion, processing, packaging, playback, and monitoring pipeline operates with **zero external services and zero internet connection**.

---

## 1. What runs locally (Everything)

| Component | Local Implementation | Notes |
|---|---|---|
| **API Server** | Fastify 5 (Node 24) on `:3000` | No cloud API dependencies |
| **Workers** | BullMQ 6 workers on Node 24 / Bun 1.4 | Probe, transcode, package, notify |
| **Database** | PostgreSQL 16 (local or compose) | Drizzle ORM, atomic migrations |
| **Queue & Pub/Sub** | Redis 7 (`noeviction` + AOF) | Local BullMQ and SSE fanout |
| **Object Storage** | MinIO (`raw` and `public` buckets) | Full S3 API parity with presigned PUT |
| **Authentication** | Ed25519 JWT issuer (`packages/server/dev-token`) | Deterministic offline dev keypair & JWKS |
| **Video Processing** | Local FFmpeg 6/7 binary | Bundled inside worker Docker image |
| **HLS Player** | Vendored `hls.js` (`tools/hls-test-page`) | Zero CDN scripts or remote fonts |
| **Metrics & Logs** | Local Prometheus, Grafana, Tempo, Loki | Docker compose `observability` profile |

---

## 2. What requires internet access (and when)

The internet is **never** contacted during normal operation or test execution. External network access is strictly confined to:

1. **One-time Initial Setup**:
   - `pnpm install` (fetching npm packages).
   - Base Docker image downloads (`node:24-slim`, `postgres:16-alpine`, `redis:7-alpine`, `minio/minio`).
2. **Optional Cloud Reference Deployment (Phase 4, Tickets 31–33)**:
   - Cloudflare R2 object storage and CDN custom domain.
   - Neon serverless PostgreSQL.
   - Cloudflare Tunnel.
   - Grafana Cloud hosted metrics/logs.

All cloud features are configured strictly via environment variables in `.env` and are deactivated by default. `.env.example` ships with 100% local configurations.

---

## 3. How to work completely offline

### Step 1: Clone and prepare environment
```bash
cp .env.example .env
```

### Step 2: Start local stack
```bash
# Start infrastructure and workers inside Docker
make up-all
```

### Step 3: Verify with Wi-Fi / Ethernet disconnected
Turn off your Wi-Fi or disconnect your network cable. Then run:
```bash
# Verify the entire end-to-end transcode and playback pipeline
make smoke-offline
```

The offline smoke test executes inside a Docker network with `internal: true`, mechanically barring any packet from leaving the host machine.

---

## 4. Local-First Guardrails & Guarantees

1. **No Phone-Home Telemetry**:
   - `TURBO_TELEMETRY_DISABLED=1` and `DO_NOT_TRACK=1` are explicitly enforced in `.env.example`, Dockerfiles, and CI.
   - OpenTelemetry tracing defaults to an inactive no-op whenever `OTEL_EXPORTER_OTLP_ENDPOINT` is unconfigured.
2. **Vendored Client Libraries**:
   - Frontend and player tools vendor all dependencies locally (e.g. `tools/hls-test-page/vendor/hls.min.js`). No script or stylesheet loads from `unpkg.com`, `cdnjs`, or `jsdelivr`.
3. **Self-Contained Container Images**:
   - Container startup scripts never invoke `apt-get`, `npm install`, or `curl` to fetch assets at runtime. Fonts (such as `fonts-dejavu-core` for FFmpeg subtitle/text filters) are pre-baked at build time.
4. **Offline CI Verification**:
   - CI runs `make smoke-offline` on an internal Docker bridge network without external gateway access, preventing regression against external dependencies.
5. **Machine-Enforced in Source**:
   - `tests/architecture/local-first.test.ts` fails the build when any production source names an off-machine
     host, or when an uncommented `.env.example` default points off the machine. The cloud rung stays behind
     commented-out keys and the `infra/` overlays, which the assertion deliberately does not scan.
