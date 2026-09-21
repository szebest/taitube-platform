# AGENTS.md — @vp/core (Domain, Ports, Repositories & Permissions)

Instructions for any coding agent working on the core domain layer (`core`).

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
├── permissions/    # Declarative CASL RBAC & ABAC authorization rules (no I/O)
├── ports/          # Abstract class ports extending HealthCheckable
└── repositories/   # Domain repository interface contracts
```

### Invariants:
1. **Ports as Abstract Classes:** Contracts in `core/ports/` are abstract classes (not interfaces) to allow `instanceof` checks, centralized contract enforcement, and uniform health checks (`HealthCheckable`).
2. **Repository Interfaces:** Repository contracts in `core/repositories/` define data access signatures decoupled from any ORM or database driver.
3. **Pure Permissions Engine:** All authorization logic in `core/permissions/` consists of pure functional rule builders evaluated via `can(user, action, resource)`.
4. **File Length Discipline:** Target <= 250 lines per file (strict maximum: 400 lines).

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
