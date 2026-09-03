# 19: Videos API completion — paginated list, metadata edits with optimistic locking, visibility, OpenAPI + contract tests

| Field | Value |
|---|---|
| Phase | 2 — Real pipeline |
| Size | M |
| Blocked by | 04 — API skeleton |
| Blocks | — |
| Spec | [PRD US-12](../PRD.md#53-status-feedback) · [PRD FR-14](../PRD.md#6-functional-requirements) · [SDD §6 API contract (all)](../SDD.md#6-api-contract) · [SDD §11 Authorisation](../SDD.md#11-security) |

**Status:** ready-for-agent

## What to build
A frontend developer reads `/docs` (OpenAPI 3.1 generated from the zod schemas) and can implement the whole client without asking questions: list my videos with cursor pagination and status filter, edit title/description/visibility with a `version` for optimistic locking, and understand every error code. A contract test suite asserts the generated OpenAPI matches the SDD §6 table (paths, methods, status codes, error codes).

## Acceptance criteria
- [ ] `GET /videos?cursor&limit&status` keyset-paginated on `(created_at, id)`, stable under concurrent inserts, scoped to the caller; `nextCursor` opaque.
- [ ] `PATCH /videos/:id` with stale `version` → 409 `VERSION_CONFLICT`; `visibility` transitions allowed `private↔unlisted↔public`.
- [ ] `/docs` serves OpenAPI 3.1 + Scalar UI; every §6.1 endpoint present with request/response schemas and problem+json error responses listing possible `code`s.
- [ ] Contract test: a table derived from SDD §6.1 is compared against the generated spec (fails on drift either way).
- [ ] Response `progress.byRendition` and `renditions[]` populated from DB for a `PROCESSING` video.

## Out of scope
Search, tags, comments (non-goals).

## Notes for the implementer
- `unlisted` videos are readable by anyone with the id; `private` only by owner/admin.

## Testing plan
Route tests via `app.inject()`; OpenAPI snapshot; pagination property test.

## Open questions
- Public vs signed playback URLs (PRD OQ-2) — MVP public via CDN; note in docs.

## Definition of Done
- [ ] AC green; SDD §6 and the spec agree.
