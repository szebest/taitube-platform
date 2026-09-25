# AGENTS.md — @vp/core (Driver Ports & Repository Contracts)

Instructions for any coding agent working on `@vp/core`.

> Tier rules for this directory: [../AGENTS.md](../AGENTS.md) · full tier & layer reference: [packages/AGENTS.md](../../AGENTS.md)

---

## 1. Scope & Architecture

`@vp/core` is the contract kernel: the abstract driver ports every adapter implements, and the
repository interfaces every persistence adapter satisfies. It holds no I/O, no SDK and no policy.

- **Strict Dependency Inversion:** `core` must NEVER import external drivers, concrete SDKs
  (`@aws-sdk/client-s3`, `ioredis`, `bullmq`, `postgres`, `drizzle-orm`), or framework code.
- **Server tier, layer 3, and deliberately so:** the layer is one above `@vp/permissions` (layer 2), and
  its dependencies are in [package.json](package.json). `ports/storage-client.ts` types `StorageBody` as
  `Buffer | Uint8Array | NodeJS.ReadableStream | string` and `getObject()` as
  `Promise<Result<Buffer, StorageUnavailable>>`. That is what a real object store hands back, and it is why
  this package cannot be `universal`.
- **The portable half already left.** Entities and value objects are `@vp/domain`, pure rules are
  `@vp/domain-rules` and `@vp/validation`, and the keyset cursor mechanism is `@vp/pagination`. All are
  `universal`. Do not add any of that code back here, where nothing client-side could reach it.

---

## 2. Directory Layout & Invariants

```
core/
├── ports/          # Driver ports: StorageClient, MultipartStorage, CacheClient, JobQueue, FlowProducerPort,
│                   #   DatabaseClient, TokenVerifier, AuthorizationPort, the three cache ports, HealthCheckable
└── repositories/   # One file per repository contract, plus the Repositories bundle (repositories.ts)
```

### Invariants:
1. **Driver ports are abstract classes.** The I/O drivers (`StorageClient`, `MultipartStorage`, `CacheClient`,
   `JobQueue`, `FlowProducerPort`, `DatabaseClient`) are abstract classes that implement the
   `HealthCheckable<E>` interface; `TokenVerifier` and `AuthorizationPort` are abstract classes without a
   health check. The cache ports (`CategoryCachePort`, `ReactionCachePort`, `SubscriptionCachePort`) are
   interfaces, which the Redis and in-memory adapters implement.
2. **Repository contracts:** `repositories/` defines data access signatures decoupled from any ORM or
   database driver - abstract classes (`VideoRepository`, `UploadRepository`, `StepRepository`, ...) and
   `*RepositoryPort` interfaces (channel, category, subscription, video reaction). The `Repositories`
   interface bundles them.
3. **Repository contracts stay with the ports.** An earlier draft split them into a universal
   `@vp/contracts`; it would have had no client consumer, because the frontend's response types come
   from `@vp/api-contracts` and `apps/web` does not import `@vp/core` at all.
4. **Barrels stay inside their folder.** `ports/index.ts` re-exports only from `./`, and so does
   `repositories/index.ts`. Import a domain symbol from `@vp/domain`, never routed through a core barrel.
5. **No `.port.ts` suffix.** The folder already says port; every file is spelled bare.
6. **File Length Discipline:** Target <= 250 lines per file (strict maximum: 400 lines).
7. **Every I/O method returns `Promise<Result<T, InfraFailure>>`** (SDD ADR-24), where `InfraFailure` is the
   narrow union for that port: `DatabaseUnavailable` for repositories and `DatabaseClient`,
   `StorageUnavailable` for `StorageClient`/`MultipartStorage`, `CacheUnavailable` for `CacheClient`,
   `QueueUnavailable` for `JobQueue`/`FlowProducerPort`. `HealthCheckable<E>` carries the same union, so a
   readiness probe reads a verdict rather than catching one.
   `tests/architecture/result-returning-ports.test.ts` enforces it as a flat assertion - every port is
   converted, so there is no exception list left.
8. **Absence is not a failure.** `findById` returns `Result<T | null, DatabaseUnavailable>`. Whether a missing
   row is an error is a *domain* decision and belongs to the rule that asks, never to the contract that looked.
9. **No `throw` anywhere in this package.** A contract that cannot fail cannot throw; a contract that can says
   so in its return type. `AuthorizationPort` answers `can` (and hands out `getAbility` / `forUser`) but never
   refuses: the refusal belongs to `authorize(...)` in `@vp/domain-rules`.

---

## 3. Dedicated References

- **Hexagonal Architecture:** `ARCHITECTURE.md`
- **Declarative Authorization:** `docs/standards/authorization.md`
- **Domain Glossary:** `CONTEXT.md`

---

## 4. Local Commands

```bash
# Typecheck core package
pnpm --filter @vp/core typecheck

# Build package
pnpm --filter @vp/core build
```
