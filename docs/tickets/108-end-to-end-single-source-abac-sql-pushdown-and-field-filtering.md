# 108: End-to-end single-source ABAC - field-level permission filter

| Field | Value |
|---|---|
| Phase | 5 — Developer experience & growth |
| Size | S |
| Blocked by | 81 - CASL declarative permissions |
| Blocks | — |
| Spec | [Declarative authorization](../standards/authorization.md) · [SDD §6.1 Endpoints](../SDD.md#61-endpoints) |

**Status:** done

> **Why.** Row scoping already has one source: `rulesToSql` in `packages/server/adapters/postgres/scopes/`
> compiles the same CASL rules into the `WHERE` that `videoReadScope` hands every repository. Field rules
> are checked on the write side only, through `canUpdateVideo({ user, video, fields })`, which asks
> `ability.can('update', video, field)` per field (`cannot('update', 'Video', 'visibility', { ownerId, status: 'REJECTED' })`
> in `video.rules.ts`). What is missing is the same answer as a list, `which of these keys may this viewer
> act on`, so a caller that holds an object can drop the keys a rule forbids instead of re-asking per key.
> Nothing reads that list today: no read-side field rule exists, and the one write-side rule is already enforced
> (`update-metadata.rule.ts` refuses a patch that names `visibility`). This ticket adds the helper and its
> proof so the first read-side field rule (monetization, private analytics) has a single place to land; it
> adds no rule of its own.

## What the code already does

| Claim in the first draft | The code |
|---|---|
| Field-level control has no universal helper | True for a list of permitted keys. A per-field check exists: `canUpdateVideo` with `fields`, covered by `helpers/__tests__/videos.test.ts` ("a video taken down") |
| `rulesToSql` restricts rows only | True, and by design: `accessibleBy` and the bound scopes are `WHERE`-only |
| Routes or services hand-omit sensitive fields | No such code. `VideoSchema` and `VideoSummarySchema` in `@vp/api-contracts` shape every response, and public and owner reads return the same shape |
| Field restrictions exist for monetization, channel analytics, processing metadata | No. The only field rule in `@vp/permissions` is the `visibility` one above |

## What to build

### 1. `pickPermittedFields` in `@vp/permissions`

In `packages/universal/permissions/src/helpers/fields.ts`, exported through `helpers/index.ts`:

```typescript
export function pickPermittedFields<TData extends object>(params: {
  ability: AppAbility;
  action: AppAction;
  subject: AppSubjects; // an instance from the normalizers, never a bare type name
  data: TData;
}): Partial<TData>;
```

- Built on `permittedFieldsOf` from `@casl/ability/extra`, with `fieldsFrom: (rule) => rule.fields ?? Object.keys(data)`.
  The fallback is required: CASL calls `fieldsFrom` for every rule and `rule.fields` is `undefined` for a rule
  without a field list, which throws (`Cannot read properties of undefined (reading 'forEach')`), and a
  sentinel such as `'*'` would stop a `cannot(..., field)` from removing anything.
- The subject is an instance, because conditional field rules only apply to one: for a type name CASL skips
  an inverted rule that has conditions, so `permittedFieldsOf(ability, 'update', 'Video', ...)` still lists
  `visibility` for the owner of a `REJECTED` video.
- Returns a new object holding the permitted keys of `data`; never mutates it.
- Zero I/O, so it runs under Node, Bun and the browser, like the rest of the package.

### 2. Documentation

`docs/standards/authorization.md` gains a short section: the three answers an ability gives (a row condition
through `rulesToSql`, a per-field verdict through `can(action, subject, field)`, a permitted-key list through
`pickPermittedFields`), and that a field rule is an instance rule, so it never becomes a SQL column list.

## Acceptance criteria

- [x] `pickPermittedFields` returns every key for a subject with no field rule, drops a key a `cannot(action, subject, field)` forbids, and keeps only the listed keys under a positive `can(action, subject, fields)`.
- [x] The owner of a `REJECTED` video has `visibility` dropped from `update`, and the owner of a `READY` video and an admin keep it (the `visibility` rule in `video.rules.ts`).
- [x] A key `data` does not carry never appears in the result, and `data` is not mutated.
- [x] `packages/universal/permissions/src/helpers/__tests__/fields.test.ts` is one `it.each` table over those cases and passes under `vitest` and `bun test`.
- [x] `authorization.md` describes the three answers; `pnpm test:architecture` stays green (`doc-paths`, `file-ceiling`).

## Out of scope

- SQL column projection (`toDrizzleSelect`). Decided against, see Open questions.
- A `usePermittedFields` React hook. Decided against, see Open questions.
- Inventing a read-side field rule or a monetization, analytics or processing-metadata policy. The first ticket that needs one adds the rule and its consumer of `pickPermittedFields`.
- Client-defined, GraphQL-style projections.

## Testing plan

- `fields.test.ts` as above, using `getUserPermissions` and the fixtures in `src/__mocks__/fixtures.ts`.
- No route test: no route consumes the helper in this ticket.

## Open questions

- **Decided: no `toDrizzleSelect`.** A field rule is conditional on the row (`status: 'REJECTED'`), and a column list cannot express a per-row condition: a type-only query ignores the inverted rule, an instance query needs the row it is about to fetch. Repositories return `VideoRecord`, the domain record `@vp/core` declares, and a narrowed `SELECT` would make that type `Partial` for every caller. Read columns are chosen by the contract schemas at the route, and the wire savings on a `videos` row are small. The first draft's signature also took an `AppAbility`, where the scopes take a `Viewer` and build the ability inside `rulesToSql`.
- **Decided: no `usePermittedFields` hook.** `useCan(canUpdateVideo, { video, fields: ['visibility'] })` already answers "may this viewer edit that field" for a form, and `PermissionsProvider` already holds the ability. A hook with no form that needs a list would be a second spelling of `useCan`.
- **Decided: the "visibility stripped from query projections" criterion is dropped.** `update` governs writes; a read projection is the `read` action, and no `read` field rule exists. The write side is already proved by `update-metadata.rule.ts` and `videos.test.ts`.
- **Decided: blockers are 81 only.** 82 (package scoping) and 84 (Result at the domain seam) do not constrain a pure helper that returns no failure.
- **Decided: file is `helpers/fields.ts`, not `helpers/permitted-fields.ts`,** next to `videos.ts`, `playlists.ts` and the other helper files; the helper takes an object parameter like every `canX` helper.
- **Decided: built now, ahead of its first consumer, at the owner's request.** `knip` flags the export, so `knip.json` gets a `packages/universal/permissions` workspace entry with `ignoreIssues` for `src/helpers/fields.ts` only; the first read-side field rule deletes that entry by using the helper.
- **Decided: the subject parameter is `AppSubjects | undefined`,** the type `toVideoSubject` returns for a missing video, and an absent subject permits no key.

## Definition of Done

- [x] All acceptance criteria proved with command output in the PR.
- [x] Ticket status set to `done` and `python3 docs/tickets/gen-index.py` re-run.
