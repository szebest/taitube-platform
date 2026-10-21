# 108: End-to-end single-source ABAC — SQL query pushdown and field-level permission filters

| Field | Value |
|---|---|
| Phase | 5 — Developer experience & growth |
| Size | M |
| Blocked by | 81 - CASL declarative permissions · 82 - Architecture remediation · 84 - Result-typed error handling |
| Blocks | — |
| Spec | [SDD §6.1 Endpoints](../SDD.md#61-endpoints) · [SDD ADR-24 Result-typed errors](../SDD.md#adr-24--result-typed-error-handling-domain-returns-the-edge-decides) |

**Status:** ready

> **Why.** (added by Gemini, let Claude verify it)
> Currently, `@vp/permissions` provides pure CASL abilities and `rulesToSql` compiles row-level condition trees into Drizzle SQL `WHERE` clauses. However, two critical gaps prevent a complete, end-to-end Single Source of Truth ABAC system:
> 1. **Field-level access control**: While CASL supports field-level restrictions (`cannot('update', 'Video', 'visibility')`), there is no universal `pickPermittedFields()` or `filterPermittedFields()` utility. When reading sensitive resources (e.g. video processing metadata, private channel analytics, monetization data), route serializers or services must manually omit fields, creating risk of data leaks.
> 2. **Generic Drizzle projection scoping (`toDrizzleSelect`)**: Currently, row scoping via `rulesToSql` restricts which rows return, but does not restrict SQL column projections (`SELECT column_a, column_b`). Pushing field permissions directly into SQL `SELECT` projections eliminates overhead of transferring and hydrating unauthorized columns from Postgres into Node/Bun memory.

## What to build (added by Gemini, let Claude verify it)

### 1. Universal field permission extractor (`pickPermittedFields`) (added by Gemini, let Claude verify it)
- In `@vp/permissions/src/helpers/permitted-fields.ts`, implement:
  ```typescript
  export function pickPermittedFields<TResource extends AppSubjects, TData extends Record<string, unknown>>(
    ability: AppAbility,
    action: AppAction,
    subject: TResource,
    data: TData
  ): Partial<TData>;
  ```
  (added by Gemini, let Claude verify it)
- Computes allowed fields using `@casl/ability` `permittedFieldsOf(ability, action, subject, { fieldsFrom: rule => rule.fields })`. (added by Gemini, let Claude verify it)
- If rules grant unconditional access to the subject without specific field restrictions, returns all fields unmodified. (added by Gemini, let Claude verify it)
- If specific fields are restricted (`cannot(action, subject, field)`), returns an immutable projection stripping disallowed keys. (added by Gemini, let Claude verify it)
- Universal and dual-runtime compatible: zero I/O, works identically in Fastify route serialization, worker telemetry, and frontend React UI. (added by Gemini, let Claude verify it)

### 2. SQL Column Projection Pushdown (`toDrizzleSelect`) (added by Gemini, let Claude verify it)
- In `packages/server/adapters/postgres/scopes/to-drizzle-select.ts`, implement:
  ```typescript
  export function toDrizzleSelect<TTable extends PgTableWithColumns<any>>(
    ability: AppAbility,
    action: AppAction,
    subject: AppSubjects,
    table: TTable
  ): SelectedFields;
  ```
  (added by Gemini, let Claude verify it)
- Intersects table schema columns with permitted fields from the CASL ability. (added by Gemini, let Claude verify it)
- When executing queries through Drizzle `db.select(toDrizzleSelect(...)).from(table).where(rulesToSql(...))`, both row filtering AND column filtering occur in the SQL engine before data crosses the wire. (added by Gemini, let Claude verify it)

### 3. Service and route serializer integration (added by Gemini, let Claude verify it)
- Integrate `pickPermittedFields` into Fastify reply serializing or service response builders (e.g. video studio metadata, channel analytics). (added by Gemini, let Claude verify it)
- Add frontend React hook `usePermittedFields(action, subject, data)` in `@vp/permissions-react` for dynamic form field rendering (e.g. hiding visibility toggles when rejected). (added by Gemini, let Claude verify it)

## Acceptance criteria (added by Gemini, let Claude verify it)

- [ ] `pickPermittedFields` correctly filters object keys based on CASL ability rules, respecting both positive `can(..., fields)` and negative `cannot(..., fields)`. (added by Gemini, let Claude verify it)
- [ ] Dedicated unit tests in `@vp/permissions/src/helpers/__tests__/permitted-fields.test.ts` with 100% test coverage matching Rule 12. (added by Gemini, let Claude verify it)
- [ ] `toDrizzleSelect` generates valid Drizzle selection dictionaries that omit restricted columns from generated SQL `SELECT` queries. (added by Gemini, let Claude verify it)
- [ ] Dedicated integration tests in `packages/server/adapters/postgres/scopes/__tests__/to-drizzle-select.test.ts`. (added by Gemini, let Claude verify it)
- [ ] End-to-end verification proving a user without `update:visibility` on a `REJECTED` video has `visibility` stripped from permitted fields and omitted from query projections. (added by Gemini, let Claude verify it)
- [ ] Dual-runtime compatibility: passes under both `vitest` and `bun test`. (added by Gemini, let Claude verify it)

## Out of scope (added by Gemini, let Claude verify it)

- Dynamic client-defined GraphQL-style projection queries. (added by Gemini, let Claude verify it)

## Testing plan (added by Gemini, let Claude verify it)

- Unit tests in `packages/universal/permissions` for `pickPermittedFields`. (added by Gemini, let Claude verify it)
- Unit tests in `packages/server/adapters/postgres/scopes` for `toDrizzleSelect`. (added by Gemini, let Claude verify it)
- Route-level integration test verifying unauthorized fields are stripped from JSON responses. (added by Gemini, let Claude verify it)

## Definition of Done (added by Gemini, let Claude verify it)

- Code committed adhering to <= 400 lines file discipline. (added by Gemini, let Claude verify it)
- Invariant tests in `tests/architecture/` pass with zero regressions. (added by Gemini, let Claude verify it)
- `python3 docs/tickets/gen-index.py` confirms index, frontier, and anchor validity. (added by Gemini, let Claude verify it)
