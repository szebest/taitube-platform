# 124: Related videos payload, one round trip less on report resolution, and removing the unused field filter

| Field | Value |
|---|---|
| Phase | 5 - Developer experience & growth |
| Size | S |
| Blocked by | 100 - Home shelves and related videos · 108 - Field-level permission filter |
| Blocks | — |
| Spec | [SDD §6.1 Endpoints](../SDD.md#61-endpoints) · [Declarative authorization](../standards/authorization.md) |

**Status:** done

> **Why.** The first draft had four items. Checked against main, one is a small real gain, one is real and tiny, one is
> the opposite of what the code needs, and one is a ratchet with nothing to catch.
>
> 1. **Related videos hydrates full rows to rank them.** `PostgresRelatedVideosRepository.find` was bounded in
>    [#219](https://github.com/szebest/taitube-platform/pull/219): four index-backed sources of at most 200 ids each
>    (co-watch, owner, tags, category), so at most 800 candidates, not the 600 the draft counted. It then runs two
>    statements: the ids with their co-watch counts, then `select * from videos` for all of them, and sorts the full rows
>    in Node with `compareRelated` to keep 20. Up to 800 wide rows (title, description, tags, keys) travel to keep 20, on
>    the watch page's hot path, which has no cache of its own. Also, when the first statement answers no ids the second
>    still runs (`inArray(v.id, [])`).
> 2. **Resolving a report for a removed comment reads the report twice.** `CommentReportService.resolve` loads it,
>    `resolveForComment` updates every open report on the comment and returns only a count, and the service then
>    `findById`s the report again. An admin click, so the saving is one primary-key read; it is a one-line port change.
> 3. **`pickPermittedFields` has no consumer and nothing is coming for one.** [108](108-end-to-end-single-source-abac-sql-pushdown-and-field-filtering.md)
>    shipped it "ahead of its first consumer, at the owner's request" behind a `knip.json` `ignoreIssues`, for a first
>    read-side field rule ("monetization, private analytics"). Searched: there is no monetisation anywhere (60 and 116
>    rule it out), no stream key (76 is not built), and the roles in [117](117-channel-team-roles.md) are an action matrix
>    per resource, with no field row. The write-side field rule (`visibility`) goes through `canUpdateVideo`, not this
>    helper. So the draft's "wire it into serializers" would invent a rule for a helper. It is deleted, and the next
>    ticket that has a real read-side field rule writes the helper with its consumer.
> 4. **Ratchets against `HGETALL` + `DEL` and `fs.readFile` in workers.** Cut. The first has one occurrence, removed by
>    [123](123-parallel-studio-upload-and-atomic-retention-flush.md), which deletes `drainRetention` itself. The second
>    would also flag `thumbnail.ts` and `segment-uploader.ts`, which read small files on purpose, so it could only
>    pass with an exception list, which [88](88-codebase-health-ratchets.md) removed. What stays is one row that keeps the
>    `knip.json` exemption from coming back.

## What to build

### 1. Rank related videos on slim rows, hydrate only the winners

In `packages/server/adapters/postgres/repositories/postgres-related-videos-repository.ts`:

- If the candidate statement returns no rows, return `ok([])` before anything else.
- Make that statement select the ranking inputs, not only ids: `id`, `ownerId`, `categoryId`, `tags`, `viewsCount`
  from `videos` joined to `candidates` and the `eligible` scope, plus the `watchers` count. Rank them in Node with the
  same `compareRelated` and signals code, so ranking stays single-sourced in `@vp/domain` and the in-memory repository
  (not re-written in SQL, where it would live twice).
- Then `select * from videos where eligible and id in (<the top limit ids>)`, and order the rows by the ranked id list.
  The eligible scope stays in this statement: a video can turn private between the two.
- Two statements as today, but 20 full rows instead of up to 800.

### 2. One read less on report resolution

- `CommentReportRepositoryPort.resolveForComment` (`packages/server/core/repositories/comment-report-repository.ts`)
  returns the `CommentReport[]` it closed (`.returning()` in `postgres-comment-report-repository.ts`, the closed rows in
  the in-memory one) instead of a count.
- `CommentReportService.resolve` takes its own report from that list and drops the `findById`. When it is not in the
  list, another resolver closed it first: return `reportAlreadyResolved`, as the `dismissed` branch does.

### 3. Delete the field filter

- Delete `packages/universal/permissions/src/helpers/fields.ts`, `__tests__/fields.test.ts` and `export * from './fields'`
  in `helpers/index.ts`; delete the `packages/universal/permissions` entry with `ignoreIssues` in `knip.json`.
- `docs/standards/authorization.md`: "Three answers from one ability" becomes two (a row condition and a per-field
  verdict); drop the permitted-key bullet and keep the sentence that a field rule is an instance rule and never a SQL
  column list.
- [108](108-end-to-end-single-source-abac-sql-pushdown-and-field-filtering.md): one line under Open questions saying
  the helper was removed here for want of a consumer. [117](117-channel-team-roles.md) loses its field-level bullet
  and its dependency on this ticket.

### 4. One ratchet row

`tests/architecture/zero-matches-rows.ts` gains a row: `ignoreIssues` in `knip.json`, expected 0, with a `fires`
fixture. It is the only one of the draft's rows that has something to hold.

## Acceptance criteria

- [ ] `find` returns the same videos in the same order as before for every case in
      `related-videos-repository.contract.ts`, over both adapters, with one added case: a video with no tags, category
      or other uploads returns `[]`.
- [ ] A spec on the Postgres adapter counts statements with a Drizzle `logger`: 1 when there are no candidates, 2
      otherwise, and the second selects at most `limit` ids.
- [ ] `resolveForComment` returns the closed reports over both adapters (contract), and `CommentReportService.resolve`
      issues no second `findById` and answers `reportAlreadyResolved` when another resolver won.
- [ ] `grep -rn pickPermittedFields apps packages docs/standards` returns nothing, `knip.json` has no `ignoreIssues`, and
      `pnpm knip` and `pnpm knip --production` pass.
- [ ] The new zero-matches row passes and fails on its own fixture.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:bun` and `pnpm test:architecture` pass, with output in the PR.

## Out of scope

- Moving the ranking into SQL, a cache for related videos, and a materialised co-watch table.
- Any read-side field rule or a field filter for [117](117-channel-team-roles.md)'s roles.
- New rows for `HGETALL` + `DEL` or `fs.readFile`, and a performance section in `docs/standards/file-discipline.md`
  (that file is about file size and layout; the rules proposed there were either false, unenforceable or already in
  `docs/agents/making-changes.md`).

## Testing plan

- Contract: `related-videos-repository.contract.ts` and `comment-report-repository.contract.ts` over in-memory and
  Postgres.
- Adapter: the statement-count spec for related videos.
- Service: `comment-report-service.test.ts` for the lost race.
- Architecture: the new row through `zero-matches.test.ts`.

## Open questions

- Decided: two statements, not one. A single statement that joins the candidates to full rows still ships up to 800
  rows; ranking on slim rows and hydrating the top 20 is the smaller transfer and keeps `compareRelated` the only
  ranking code.
- Decided: not measured against a database here (none is running). The first thing to do in the PR is `EXPLAIN
  (ANALYZE, BUFFERS)` of both versions on the seeded data and paste it; if the slim statement is not smaller in bytes,
  drop item 1 and keep the early return.
- Decided: the helper is deleted instead of integrated; integration would need a rule nobody has asked for.

## Definition of Done

- [ ] All acceptance criteria proved with command output in the PR.
- [ ] Ticket status set to `done` and `python3 docs/tickets/gen-index.py` re-run.
