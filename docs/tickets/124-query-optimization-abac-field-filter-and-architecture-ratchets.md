# 124: Query optimization, ABAC field-filter consolidation & architecture ratchets

| Field | Value |
|---|---|
| Phase | 5 — Developer experience & growth |
| Size | M |
| Blocked by | 100 - Home shelves · 103 - Comment inbox · 108 - Single-source ABAC |
| Blocks | 117 |
| Spec | [SDD §6.1 Endpoints](../SDD.md#61-endpoints) · [SDD §11 Security](../SDD.md#11-security) |

**Status:** blocked

> **Why.** (written by Gemini, let Claude verify)
> Reviews of recent backend and domain implementations revealed several query inefficiencies, a stranded ABAC field filter, and missing architectural ratchets:
> 1. **Related videos double-query & JavaScript memory sorting**: `PostgresRelatedVideosRepository` executes two sequential queries for every recommendation request and pulls up to 600 complete `VideoRecord` entities into Node.js heap memory to sort them using `Array.prototype.sort()`. Furthermore, an empty candidate set executes an unnecessary query with `inArray(v.id, [])` instead of early-exiting.
> 2. **Redundant 3rd query on comment report resolution**: In `CommentReportService.resolve`, resolving reports for a removed comment calls `resolveForComment`, followed by an extra `findById` query to retrieve the report that was just updated.
> 3. **Stranded ABAC field filter (`pickPermittedFields`)**: Ticket 108 implemented `pickPermittedFields` in `@vp/permissions`, but left it without active call sites. To bypass CI linter failure, `knip.json` was edited with a blanket ignore. Future ticket 117 (Channel team roles) directly requires field-level permission filtering to restrict sensitive video and channel properties per role.
> 4. **Missing architectural guardrails against regression**: The codebase currently lacks machine-checked ratchets against dangerous patterns such as bare `HGETALL + DEL` cache drains, media whole-file RAM reads in workers, and `knip.json` ignore exemptions for newly added exports.

## What to build (written by Gemini, let Claude verify)

### 1. Related Videos Query Optimization
- In `packages/server/adapters/postgres/repositories/postgres-related-videos-repository.ts`:
  - Early-exit immediately with `ok([])` if the candidate set or watchers map is empty, avoiding redundant database roundtrips.
  - Consolidate candidate retrieval and full row hydration into a single SQL statement where candidate scoring and filtering occur in Postgres rather than pulling hundreds of full records into Node.js memory.

### 2. Single-Trip Comment Report Resolution
- In `packages/server/adapters/postgres/repositories/postgres-comment-report-repository.ts`:
  - Update `resolveForComment` to use `RETURNING *` so that updated report records are returned directly from the update operation.
  - In `apps/server/api/src/services/comment-report-service.ts`, use the returned record directly, eliminating the redundant `findById` roundtrip.

### 3. ABAC Field Filter Integration & Knip Ignore Removal
- In `@vp/permissions`:
  - Wire `pickPermittedFields` into video and channel view serializers so that sensitive fields are stripped declaratively based on caller ability.
  - Ensure compatibility with [117](117-channel-team-roles.md)'s upcoming role matrix (managers, editors, moderators, analytics).
  - Remove the `"packages/universal/permissions/src/helpers/fields.ts"` exemption from `knip.json`, ensuring zero dead exports.

### 4. Architectural Ratchets & Anti-Pattern Prevention
- In `tests/architecture/zero-matches-rows.ts`:
  - Add a row asserting zero bare `HGETALL` + `DEL` sequences in Redis adapters without a staged buffer key.
  - Add a row prohibiting `fs.readFile` or `readFileSync` of media chunk outputs in worker stage processors (mandating streams).
- In `docs/standards/`:
  - Document the anti-patterns (no serial multipart loops, no unstaged cache drains, no reading whole media files into worker memory) in `docs/standards/file-discipline.md` and `docs/standards/testing.md`.

## Acceptance criteria (written by Gemini, let Claude verify)

- [ ] `PostgresRelatedVideosRepository` short-circuits with `ok([])` on empty candidate sets and eliminates in-memory sorting of hundreds of unranked rows in Node.js. (written by Gemini, let Claude verify)
- [ ] `resolveForComment` in `postgres-comment-report-repository.ts` uses `RETURNING *` and eliminates the third `findById` lookup in `CommentReportService.resolve`. (written by Gemini, let Claude verify)
- [ ] `pickPermittedFields` is integrated into API serializers, and the ignore rule in `knip.json` is completely removed with `pnpm knip` passing clean. (written by Gemini, let Claude verify)
- [ ] New architectural ratchets in `tests/architecture/zero-matches-rows.ts` prevent regressions on unstaged Redis drains and worker media memory buffering. (written by Gemini, let Claude verify)
- [ ] All updated repository contract tests pass under both in-memory and PostgreSQL adapters. (written by Gemini, let Claude verify)
