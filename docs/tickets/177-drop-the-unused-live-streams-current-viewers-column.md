# 177: Drop the unused live_streams.current_viewers column

| Field | Value |
|---|---|
| Phase | 5 - Developer experience & growth |
| Size | S |
| Blocked by | 119 - Playlists and lists · 120 - Community posts and threads |
| Blocks | — |
| Spec | [76 Live streaming](76-live-streaming-rtmp-whip-llhls-packaging-chat.md) · [SDD live viewers](../SDD.md) |

**Status:** blocked

## What to build

Remove `live_streams.current_viewers`. The viewer count lives in Redis (`LivePresencePort`, a sorted set per stream), `GET /v1/live` and `GET /v1/live/:id` read it from there, and nothing writes the column: `docs/SDD.md` says "`live_streams.current_viewers` is not written". A column that is always `0` and a `currentViewers` field on the domain type invite the next reader to trust it.

Where it still appears on this branch:

- `packages/server/db/src/live-schema.ts` (`currentViewers`, default `0`)
- `packages/universal/domain/src/live.ts` (the `LiveStream` type) and `packages/universal/domain/src/__tests__/live.test.ts`
- `packages/server/adapters/in-memory/repositories/in-memory-live-stream-repository.ts`
- test fixtures: `packages/universal/domain-rules/src/__tests__/entities.ts`, `apps/server/api/src/services/__tests__/live-harness.ts`
- `docs/SDD.md` (the viewers paragraph, and the schema description if it lists the column)
- a new migration

## Acceptance criteria

- [ ] A migration drops the column, with the Drizzle snapshot generated on top of the migrations 119 and 120 add. 0050 is expected (head is 0047 on this branch and 119 and 120 each add one), but take the next free number at pickup and say so in the PR.
- [ ] The field is gone from the schema, the `LiveStream` domain type, the in-memory repository and every fixture; `pnpm typecheck` finds no reference.
- [ ] Viewer counts still arrive on `GET /v1/live`, `GET /v1/live/:id` and the `live.viewers` event, unchanged (existing specs stay green without edits to their expectations).
- [ ] `docs/SDD.md` no longer says the column is "not written": the sentence goes, and the viewers paragraph reads as the Redis count only. Updated in the same PR.
- [ ] The Postgres contract tests pass on a database migrated from empty, and on one migrated up to the previous head and then to this one.

## Setup & environment

None.

## Out of scope

- Moving the viewer count anywhere else, or persisting peak viewers (a separate decision if analytics want it).
- Other columns of `live_streams`.

## Notes for the implementer

- Why blocked: the Drizzle snapshot is a chain. A snapshot generated before 119 and 120 merge would be rebased by hand, and a wrong one corrupts the next `drizzle-kit generate`.
- `0032_live_streaming.sql` and the old snapshots mention the column; they are history, leave them.
- Raised by the status and loose-ends audit (2026-11-27): the SDD line is the only place that admits the column is dead. Live streaming landed in [#287](https://github.com/szebest/taitube-platform/pull/287) and [#294](https://github.com/szebest/taitube-platform/pull/294).

## Testing plan

Typecheck and the existing live specs, the Postgres adapter contract suite against a freshly migrated database, `pnpm test:architecture` for the schema drift checks.

## Open questions

- None.

## Definition of Done

- [ ] Merged; SDD updated; `gen-index.py` re-run.
