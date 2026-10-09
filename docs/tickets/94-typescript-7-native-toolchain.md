# 94: TypeScript 7 native toolchain for typecheck and build

| Field | Value |
|---|---|
| Phase | 5 — Developer experience & growth |
| Size | S |
| Blocked by | — |
| Blocks | — |
| Spec | [SDD §15.2 Toolchain](../SDD.md#152-toolchain) · [SDD ADR-20 Workspace boundaries](../SDD.md#adr-20--monorepo-topology-workspace-boundaries-and-contract-single-sourcing) |

**Status:** blocked-by-date

> **Blocked on upstream, not on a ticket or a date.** `blocked-by-date` is the closest status the index has: it
> keeps this ticket off the frontier until someone sets it to `ready` by hand. Do that when both checks pass:
>
> - openapi-typescript: [openapi-ts/openapi-typescript#2841](https://github.com/openapi-ts/openapi-typescript/issues/2841)
>   is closed **and** `npm view openapi-typescript peerDependencies` allows `typescript` 7.
> - Architecture specs: `npm view typescript@latest exports` exposes a stable compiler API (an entry that is not
>   under `unstable/`), **or** the specs are ported off the classic API first.
>
> If you want the typecheck on 7 before upstream moves, see the alternative under "What to build".

## What we know (tried 2026-10-09 on #141)

TypeScript 7.0.2 was tried and reverted.

- The native compiler passes 81 of 82 tsconfigs.
- The api app (today `apps/api`) has 7 TS2883 errors ("inferred type cannot be named", from light-my-request's
  `Response`) in 3 test helpers: `src/__tests__/categories-app.ts`, `src/__tests__/subscriptions-app.ts` and
  `src/__tests__/upload-requests.ts`. Each needs an explicit return type.
- openapi-typescript 7.13 calls `ts.factory`, which TS 7 no longer exports, so the api-contracts build crashes
  (upstream [#2841](https://github.com/openapi-ts/openapi-typescript/issues/2841), open; its peer range is
  `typescript ^5.x`).
- 25 files under `tests/architecture` import the classic compiler API
  (`git grep -l -E "from ['\"]typescript['\"]" tests/architecture`). TS 7 exports only `typescript/unstable/*`.
- Verified fine on 7: knip (oxc parser), tsx, esbuild, vite and rolldown, drizzle-kit, the TanStack Router
  generator, the fastify type providers (types only).

## What to build

Once unblocked:

- `typescript@7` for typecheck and build in every workspace.
- While a JS API consumer still needs the classic API, a `typescript6` alias (`"typescript6": "npm:typescript@6"`)
  as a devDependency, only in the package that needs it.
- openapi-typescript resolves `typescript` by name, so redirect it to the alias with pnpm `packageExtensions` or
  `overrides` in `pnpm-workspace.yaml`.
- The architecture specs import the alias, or are ported to the stable API.
- Explicit return types on the three api test helpers above.
- Drop the alias once both consumers support TS 7 natively (the same checks as the unblock check).

Alternative, if Mateusz wants the typecheck on 7 before upstream moves: ship it early with the alias for both
consumers (openapi-typescript and the architecture specs), and make dropping the alias the follow-up.

Paths name the api app as it is today; after [92](92-apps-grouped-by-tier.md) moves apps into `apps/server` and
`apps/client`, read them there.

## Acceptance criteria

- [ ] Every tsconfig typechecks on TypeScript 7 (`pnpm typecheck`).
- [ ] The api-contracts build and `pnpm gen:contracts` leave the committed OpenAPI document and generated types
      without drift.
- [ ] The architecture suite (`pnpm test:architecture`) is green and within its CI budget (8 s).
- [ ] The alias, if still present, does not reach the Dockerfile `turbo prune` output or any runtime image.
- [ ] `pnpm lint`, `pnpm test`, `pnpm test:bun`, `pnpm knip`, `pnpm boundaries` and CI green.

## Out of scope

- Moving build or bundling tools off esbuild, Vite or tsx.
- Any change to what the typecheck accepts beyond the three helper return types.

## Notes for the implementer

- Re-run the full tsconfig sweep first: the 81 of 82 count is from 7.0.2 and the failure set may have moved.
- Confirm the unblock checks on the day, not from this ticket's text.

## Definition of Done

- [ ] All acceptance criteria proved with command output in the PR.
- [ ] `docs/SDD.md` §15.2 Toolchain and `ARCHITECTURE.md` updated if the toolchain description changes.
- [ ] Ticket status set to `done` and `python3 docs/tickets/gen-index.py` re-run.
