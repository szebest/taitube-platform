# Testing Standards & Strategy

This document outlines the testing pyramid, execution models, and verification standards for the `video-pipeline` monorepo.

---

## 1. Testing Pyramid & Strategy

The repository strictly enforces a layered testing model designed for speed, isolation, and deterministic contracts:

```
                  +--------------------------------+
                  |    E2E & Smoke Verification    |  (Docker Compose / Offline)
                  +--------------------------------+
                  |  Durability & Integration Tests|  (Real PostgreSQL & Redis)
                  +--------------------------------+
                  | Deterministic Unit Test Suites |  (In-Memory Port Doubles)
                  +--------------------------------+
```

### Layer 1: Deterministic Unit Tests (In-Memory Doubles)
- **Target:** Domain services (`apps/api/src/services/`), route handlers (`apps/api/src/routes/`), worker pipeline stages (`apps/worker/src/stages/`), and core domain logic (`core/`).
- **Isolation:** Never spin up Docker containers, network sockets, or external databases for unit tests.
- **Port Doubles:** Depend exclusively on autonomous in-memory test doubles from `adapters/in-memory` (`InMemoryDatabaseClient`, `InMemoryStorageClient`, `InMemoryCacheClient`, `InMemoryJobQueue`, `InMemoryRepositories`).
- **Autonomous State:** Every in-memory double manages its own state and exposes `.clear()` to allow fast test teardown without recreating class instances.

### Layer 2: Durability & Integration Tests (Real PostgreSQL)
- **Target:** Concrete database repositories (`adapters/postgres/repositories/`), schema migrations (`packages/db/`), and state machine transitions.
- **Contract Verification:** Proves compare-and-set (CAS) state transitions, atomic append of `video_events`, and fencing token validations (`lock_token` UUIDs) against an authoritative PostgreSQL instance.
- **Execution Parity:** Runs against PostgreSQL 16 provided via Docker Compose (`make up`) locally and GitHub Actions service containers in CI.

### Layer 3: End-to-End Smoke & Acceptance Tests
- **Target:** Full-pipeline execution from presigned upload to FFmpeg transcode, thumbnail sprite generation, HLS manifest packaging, and playback readiness.
- **Local-First & Offline:** Validated via `make smoke` and `make smoke-offline` (network isolation with Docker bridge `internal: true`).

---

## 2. Dual-Runtime Worker Parity

All worker stages, pipeline processors, and shared packages (`packages/*`, `core/*`, `adapters/*`) must execute identically under both target runtimes:

1. **Node.js 24 LTS:** Primary API server and baseline worker runtime.
2. **Bun 1.4+:** High-throughput execution runtime for queue workers.

### Parity Constraints
- Workers must import only Node.js standard library APIs (`node:fs`, `node:path`, `node:os`, `node:child_process`).
- **Strictly Forbidden:** Calling `Bun.*` proprietary APIs in worker implementation files.
- Test suites covering workers and shared packages must pass under both test runners:
  ```bash
  pnpm test       # Vitest (Node.js)
  pnpm test:bun   # Bun test runner
  ```

---

## 3. Test Execution Commands

| Scope | Command | Description |
|---|---|---|
| **All Unit Tests** | `pnpm test` | Run Vitest across all workspace packages |
| **Worker Bun Parity** | `pnpm test:bun` | Run worker and shared package tests under Bun |
| **Worker Unit Tests** | `pnpm --filter @vp/worker test` | Run worker tests using Vitest |
| **API Unit Tests** | `pnpm --filter @vp/api test` | Run API route and service tests using Vitest |
| **Database Durability** | `pnpm --filter @vp/db test` | Run migration and database schema tests |
| **Adapters Suite** | `pnpm --filter @vp/adapters test` | Run adapter in-memory and concrete unit tests |
| **Core Suite** | `pnpm --filter @vp/core test` | Run domain and declarative permission engine tests |
| **Fast Smoke Test** | `make smoke-fast` | Fast smoke test against currently running containers |
| **Full Smoke Test** | `make smoke` | Stand up fresh containers and run end-to-end smoke verification |
| **Offline Smoke Test** | `make smoke-offline` | Run smoke test with simulated zero network egress |
| **Acceptance Suite** | `make e2e` | Run comprehensive end-to-end acceptance test suite |

---

## 4. Test Authoring Best Practices & Invariants

1. **Zero Heuristic Skips:** Test suites must never swallow connection errors or conditionally skip test assertions (e.g. `try { connect() } catch { skip() }`). If a required service is unavailable, tests must fail immediately and loudly.
2. **Deterministic Assertions:** Use deterministic seeds and synthetic test fixtures (`pnpm gen-video`). Never rely on unpredictable real-time clock delays; use fake timers (`vi.useFakeTimers()`) or explicit completion signals.
3. **Seam Isolation:** Always test domain services directly through their port interfaces rather than spinning up full HTTP servers when verifying domain invariants.
4. **Clean Teardown:** Test files must register `afterEach` or `afterAll` hooks to reset in-memory doubles (`repositories.clear()`), close database connection pools, and remove temporary test files.
