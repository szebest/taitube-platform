# 50: Shared API contracts package (`@taitube/api-contracts`) & automated OpenAPI TypeScript codegen

| Field | Value |
|---|---|
| Phase | 5 — Developer experience & growth |
| Issue | [#50](https://github.com/szebest/taitube-platform/issues/50) |
| Size | M |
| Blocked by | 19 — Videos API completion · 37 — Admin category API · 38 — User identity |
| Blocks | 51, 52 |
| Spec | [SDD §6.1 Endpoints](../SDD.md#61-endpoints) · [SDD §6.2 Error codes](../SDD.md#62-error-codes-stable-machine-readable) |

**Status:** in-progress

> **Result-typed error handling (ticket 84, SDD ADR-24).** Any service this ticket adds or touches returns
> `Promise<Result<T, E>>` with an **inferred** error union and contains no `throw`, `try` or `catch`. Input
> checks belong in `@vp/validation`, entity-dependent decisions in `@vp/domain-rules`, and routes hand the
> `Result` to `sendResult`. A new error code must land in `ApiErrorCodes`, `PROBLEM_STATUS`, `RETRY_CLASS` and
> SDD §6.2 together, or it does not compile. Authority:
> [docs/standards/error-handling.md](../standards/error-handling.md).

> **Ticket 84 note:** `problemFor(failure, instance, overrides?)` in `@vp/api-contracts` is the single
> `Problem` renderer — both `sendResult` and the Fastify backstop call it. The contracts package carries no
> second error taxonomy: the discriminant of every failure is the existing `ErrorCode`. See [84](84-result-typed-error-handling-shared-domain-rules.md).

## What to build

In many full-stack applications, frontend developers manually write and maintain duplicate TypeScript interfaces for backend responses. Over time, when a backend engineer renames a field, changes an enum, or makes a property optional, the frontend experiences silent runtime errors and broken UI rendering.

This ticket establishes **End-to-End Type Safety** by single-sourcing all API schemas into a dedicated workspace package: **`packages/api-contracts`** (`@taitube/api-contracts` or `@taitube/api-contracts`):

1. **Single-Sourced Zod Schemas**:
   - Moves HTTP request body, query params, path params, and response Zod schemas from `apps/api/src/schemas/` into `packages/api-contracts/src/schemas/`.
   - Both Fastify routes (`apps/api`) and the web client (`apps/web`) import from the exact same schema source.
2. **Automated TypeScript Contract Generation (OpenAPI -> TypeScript)**:
   - Sets up a deterministic code generator: `pnpm gen:contracts`.
   - Extracts the generated OpenAPI 3.1 JSON from Fastify (`@fastify/swagger`) and generates strict, typed client interfaces (using `openapi-typescript` or `zod-to-ts`).
3. **Strict Contract Drift CI Check**:
   - Automated test `tests/contract-drift.test.ts` running in CI that asserts:
     - The generated OpenAPI schema matches the committed contracts package.
     - Any pull request modifying an API endpoint without updating contracts fails CI immediately.

## Acceptance criteria

- [ ] New monorepo package `packages/api-contracts` created and added to `pnpm-workspace.yaml`.
- [ ] Zod schemas migrated and exported:
  - Video schemas (`VideoDto`, `VideoSummaryDto`, `CreateUploadDto`, `PatchVideoDto`).
  - Category schemas (`CategoryDto`, `CreateCategoryDto`).
  - Channel / User schemas (`ChannelProfileDto`, `UpdateAccountDto`).
  - Comments & Reactions schemas (`CommentDto`, `ReactionDto`).
  - Problem Details standard error schema (`ProblemDetailsDto`).
- [ ] Fastify `apps/api` updated to consume schemas from `@taitube/api-contracts`.
- [ ] Fastify type provider (`ZodTypeProvider`) infers route parameters directly from `@taitube/api-contracts`.
- [ ] CLI command `pnpm gen:contracts` exports static types into `packages/api-contracts/dist/types.d.ts`.
- [ ] CI drift guard test: Fails if an endpoint is changed in `apps/api` without running `pnpm gen:contracts`.
- [ ] Dual runtime compatibility: `packages/api-contracts` passes all tests under both `vitest` and `bun test`.

## Out of scope

- Generating SDKs for non-TypeScript languages (Python, Go, etc.).

## Notes for the implementer

- Keep schema definitions organized into domain modules <= 250 lines per file:
  - `packages/api-contracts/src/schemas/videos.schema.ts`
  - `packages/api-contracts/src/schemas/categories.schema.ts`
  - `packages/api-contracts/src/schemas/channels.schema.ts`
  - `packages/api-contracts/src/schemas/comments.schema.ts`
- Export both the Zod runtime validator and the static inferred type:
  ```ts
  export const VideoSchema = z.object({ ... });
  export type Video = z.infer<typeof VideoSchema>;
  ```

## Testing plan

- Unit test in `packages/api-contracts` asserting Zod schemas round-trip valid and invalid JSON payloads.
- Integration test in `apps/api` validating Fastify route typing with the shared contracts package.
- Drift guard test running in CI.

## Definition of Done

- [ ] `pnpm --filter @taitube/api-contracts test` passes under Vitest and Bun.
- [ ] `apps/api` builds and typechecks cleanly with the new package.
- [ ] Architecture and decision docs updated (`ARCHITECTURE.md`, `docs/SDD.md` and ADRs if boundaries, packages or contracts changed).
- [ ] Ticket status set to `done` and `python docs/tickets/gen-index.py` re-run.
