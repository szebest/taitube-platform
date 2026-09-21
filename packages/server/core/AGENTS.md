# AGENTS.md — @vp/core (Domain, Ports, Repositories & Permissions)

Instructions for any coding agent working on the core domain layer (`core`).

> Tier rules for this directory: [../AGENTS.md](../AGENTS.md) · full tier & layer reference: [packages/AGENTS.md](../../AGENTS.md)
---

## 1. Scope & Architecture

`@vp/core` is the dependency-free domain kernel of the `video-pipeline` monorepo.
- **Strict Dependency Inversion:** `core` must NEVER import external drivers, concrete SDKs (`@aws-sdk/client-s3`, `ioredis`, `bullmq`, `postgres`, `drizzle-orm`), or framework code.
- **Zero I/O Dependencies:** The domain logic, entities, and permission evaluators are pure TypeScript modules.

---

## 2. Directory Layout & Invariants

```
core/
├── domain/         # Pure domain entities, value objects, and domain types
├── pagination/     # Shared keyset Paginator and pluggable CursorCodec (no I/O)
├── permissions/    # Declarative CASL RBAC & ABAC authorization rules (no I/O)
├── ports/          # Abstract class ports extending HealthCheckable
└── repositories/   # Domain repository interface contracts
```

### Invariants:
1. **Ports as Abstract Classes:** Contracts in `packages/server/core/ports/` are abstract classes (not interfaces) to allow `instanceof` checks, centralized contract enforcement, and uniform health checks (`HealthCheckable`).
2. **Repository Interfaces:** Repository contracts in `packages/server/core/repositories/` define data access signatures decoupled from any ORM or database driver.
3. **Pure Permissions Engine:** All authorization logic in `packages/server/core/permissions/` consists of pure functional rule builders evaluated via `can(user, action, resource)`.
4. **One Pagination Mechanism:** Every paginated endpoint uses `Paginator` from `packages/server/core/pagination/`. Repositories return `limit + 1` rows and never encode a cursor; the wire format lives behind `CursorCodec` and is swappable. Page bounds come from `PAGE_SIZE_DEFAULT`/`PAGE_SIZE_MAX` at the composition root — never hard-coded at a call site.
5. **File Length Discipline:** Target <= 250 lines per file (strict maximum: 400 lines).

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

# Run unit tests
pnpm --filter @vp/core test

# Build package
pnpm --filter @vp/core build
```
