# AGENTS.md — @vp/core (Driver Ports & Repository Contracts)

Instructions for any coding agent working on `@vp/core`.

> Tier rules for this directory: [../AGENTS.md](../AGENTS.md) · full tier & layer reference: [packages/AGENTS.md](../../AGENTS.md)
---

## 1. Scope & Architecture

`@vp/core` is the contract kernel: the abstract driver ports every adapter implements, and the
repository interfaces every persistence adapter satisfies. It holds no I/O, no SDK and no policy.

- **Strict Dependency Inversion:** `core` must NEVER import external drivers, concrete SDKs
  (`@aws-sdk/client-s3`, `ioredis`, `bullmq`, `postgres`, `drizzle-orm`), or framework code.
- **Server tier, and deliberately so:** `ports/storage-client.ts` types `StorageBody` as
  `Buffer | Uint8Array | NodeJS.ReadableStream | string` and `getObject()` as `Promise<Buffer>`. That
  is what a real object store hands back, and it is why this package cannot be `universal`.
- **The portable half already left.** Entities, value objects and policy are `@vp/domain`; the keyset
  cursor mechanism is `@vp/pagination`. Both are `universal`. Do not add either kind of code back here
  — a pure rule or a value object belongs in `@vp/domain`, where `apps/web` can reach it.

---

## 2. Directory Layout & Invariants

```
core/
├── ports/          # Abstract class ports extending HealthCheckable
└── repositories/   # Domain repository interface contracts
```

### Invariants:
1. **Ports as Abstract Classes:** Contracts in `ports/` are abstract classes (not interfaces) to allow
   `instanceof` checks, centralized contract enforcement, and uniform health checks (`HealthCheckable`).
2. **Repository Interfaces:** Contracts in `repositories/` define data access signatures decoupled from
   any ORM or database driver.
3. **Repository contracts stay with the ports.** An earlier draft split them into a universal
   `@vp/contracts`; it would have had no client consumer, because the frontend's response types come
   from `@vp/api-contracts` and `apps/web` does not import `@vp/core` at all.
4. **Barrels stay inside their folder.** `ports/index.ts` re-exports only from `./`, and so does
   `repositories/index.ts`. Import a domain symbol from `@vp/domain`, never routed through a core barrel.
5. **No `.port.ts` suffix.** The folder already says port; every file is spelled bare.
6. **File Length Discipline:** Target <= 250 lines per file (strict maximum: 400 lines).
7. **Every I/O method returns `Promise<Result<T, InfraFailure>>`** (SDD ADR-24), where `InfraFailure` is the
   narrow union for that port: `DatabaseUnavailable` for repositories, `StorageUnavailable` for
   `StorageClient`/`MultipartStorage`, `CacheUnavailable` for `CacheClient`, `QueueUnavailable` for
   `JobQueue`/`FlowProducer`. `tests/architecture/result-returning-ports.test.ts` enforces it, with a
   shrink-only list of what is not converted yet.
8. **Absence is not a failure.** `findById` returns `Result<T | null, DatabaseUnavailable>`. Whether a missing
   row is an error is a *domain* decision and belongs to the rule that asks, never to the contract that looked.
9. **No `throw` anywhere in this package.** A contract that cannot fail cannot throw; a contract that can says
   so in its return type.

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
