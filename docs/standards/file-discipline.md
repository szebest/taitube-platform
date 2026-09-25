# File Discipline & Modular Architecture Standards

This document defines the file size limits, modular repository organization, and deep module design principles enforced across the `video-pipeline` monorepo.

---

## 1. File Length Discipline & Sizing Limits

To ensure high readability, ease of maintenance, and optimal context management for both human developers and AI coding agents, all code files must adhere to strict bounds:

- **Target File Size:** `<= 250 lines` of code per file.
- **Strict Upper Ceiling:** `400 lines` (or approximately `10 KB`) per file.
- **Trigger for Decomposition:** Any file exceeding 300 lines must be reviewed for extraction of submodules, utility helpers, type definitions, or sub-services.
- **Machine-enforced:** `tests/architecture/file-ceiling.test.ts` fails on any tracked `.ts`/`.tsx` file over
  400 lines or 10 KB, specs and `tests/` included. There is no exception list: a spec that outgrows the
  ceiling splits by behaviour, with its shared setup in a helper module beside it.

---

## 2. Modular Repository Design

Every domain entity data access layer must be structured as dedicated single-file repositories:

### Directory Structure
```
packages/server/adapters/
├── postgres/
│   ├── postgres-database-client.ts
│   ├── pg-errors.ts
│   ├── mappers/                            # Row -> entity mappers, one file per entity
│   ├── scopes/                             # SQL filters: CASL rules to SQL, keyset, soft delete
│   ├── repositories/
│   │   ├── postgres-category-repository.ts
│   │   ├── postgres-channel-repository.ts
│   │   ├── postgres-dlq-repository.ts
│   │   ├── postgres-event-repository.ts
│   │   ├── postgres-outbox-repository.ts
│   │   ├── postgres-rendition-repository.ts
│   │   ├── postgres-step-repository.ts
│   │   ├── postgres-subscription-repository.ts
│   │   ├── postgres-upload-repository.ts
│   │   ├── postgres-user-repository.ts
│   │   ├── postgres-video-reaction-repository.ts
│   │   ├── postgres-video-repository.ts
│   │   ├── postgres-repositories.ts        # Lightweight factory container
│   │   ├── public-feed-query.ts            # Query helpers the repositories share
│   │   ├── video-scan-query.ts
│   │   ├── types.ts
│   │   └── index.ts
│   └── index.ts
└── in-memory/
    ├── in-memory-database-client.ts
    ├── in-memory-*.ts                      # The other port doubles (cache, queue, storage, ...)
    ├── repositories/
    │   ├── in-memory-category-repository.ts
    │   ├── in-memory-channel-repository.ts
    │   ├── in-memory-dlq-repository.ts
    │   ├── in-memory-event-repository.ts
    │   ├── in-memory-outbox-repository.ts
    │   ├── in-memory-rendition-repository.ts
    │   ├── in-memory-step-repository.ts
    │   ├── in-memory-subscription-repository.ts
    │   ├── in-memory-upload-repository.ts
    │   ├── in-memory-user-repository.ts
    │   ├── in-memory-video-reaction-repository.ts
    │   ├── in-memory-video-repository.ts
    │   ├── in-memory-repositories.ts       # Lightweight factory container
    │   ├── keyset.ts                       # Query helpers the repositories share
    │   ├── public-feed-query.ts
    │   ├── types.ts
    │   └── index.ts
    └── index.ts
```

### Invariants
1. **Never Create Monolithic Repository Files:** Never declare multiple domain repository classes inside a single file.
2. **Container As Lightweight Factory:** The `*Repositories` class is strictly an aggregator/factory bundling the individual repository instances.
3. **Autonomous Test Doubles:** In-memory doubles manage their own in-memory collections, expose `.clear()` for resets, and interact with other repositories only via port interfaces.

---

## 3. Deep Modules vs Thin Adapters

Following deep module design principles (`codebase-design`):
- **Deep Modules (Services):** Substantial functionality hidden behind a clean, simple, stable interface. Examples: `UploadService`, `VideoService`, `CategoryService`.
- **Thin Adapters (Routes):** Route handlers in `apps/api/src/routes/` are strictly transport adapters: they validate input with Zod, extract auth claims, delegate to domain services, and return HTTP status codes and headers.
- **Service Composition:** A service's collaborators are injected and required; stateless helpers shared between services (`http-cache.ts`, `@vp/concurrency`'s `Singleflight`) are imported, not injected.

---

## 4. Mandatory 1:1 Test File Correspondence

Every single source file, helper, utility, normalizer, rule, or adapter across the monorepo MUST map to at least one dedicated test file matching its name (e.g. `video.normalizer.ts` -> `video.normalizer.test.ts`). Grouping tests for multiple separate source files into a single bundled test file is a strict architectural violation.
